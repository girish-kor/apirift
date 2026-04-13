'use strict';

const path    = require('path');
const fs      = require('fs-extra');
const logger  = require('../utils/logger');
const { normalize }    = require('../utils/normalize');
const { latencyStats } = require('../utils/stats');
const { readLogs }     = require('../storage/fileStore');

/**
 * analyzeDrift — compare baseline vs candidate JSONL logs.
 *
 * Drift types detected:
 *   STATUS_MISMATCH       HTTP status differs
 *   BODY_DIFF             Normalised response body differs
 *   LATENCY_EXCEEDED      Absolute ms regression
 *   LATENCY_RATIO         Proportional ms regression (N× slower)
 *   MISSING_IN_CANDIDATE  Endpoint in baseline only
 *   NEW_IN_CANDIDATE      Endpoint in candidate only
 *   REPLAY_ERROR          Network failure in candidate (status 0)
 *
 * @param {object}   opts
 * @param {string}   opts.baseline
 * @param {string}   opts.candidate
 * @param {string}   opts.reportDir
 * @param {number}   opts.latencyThreshold   Absolute ms over baseline
 * @param {number}   opts.latencyRatio        Multiplier threshold (e.g. 2)
 * @param {string[]} opts.normalizeKeys       Extra volatile keys to strip
 * @param {number[]} opts.ignoreStatus        HTTP codes to skip in comparison
 */
async function analyzeDrift({
  baseline,
  candidate,
  reportDir        = 'reports',
  latencyThreshold = 500,
  latencyRatio     = null,
  normalizeKeys    = [],
  ignoreStatus     = []
} = {}) {
  if (!baseline || !candidate) throw new Error('--baseline and --candidate are required');

  const [baseLogs, candLogs] = await Promise.all([readLogs(baseline), readLogs(candidate)]);
  const ignoreSet = new Set(ignoreStatus);

  function makeIndex(logs) {
    const map = new Map();
    for (const e of logs) {
      const k = `${e.method}:${e.url}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    return map;
  }

  const baseIdx = makeIndex(baseLogs);
  const candIdx = makeIndex(candLogs);
  const normStr = raw => JSON.stringify(normalize(raw, normalizeKeys));

  const report = {
    generatedAt:     new Date().toISOString(),
    baselineFile:    baseline,
    candidateFile:   candidate,
    totalBaseline:   baseLogs.length,
    totalCandidate:  candLogs.length,
    summary: { statusMismatch: 0, bodyDiff: 0, latencyExceeded: 0, latencyRatio: 0, missingInCandidate: 0, newInCandidate: 0, replayErrors: 0, totalDrifts: 0 },
    latencyBaseline:  latencyStats(baseLogs.map(e => e.latencyMs).filter(Boolean)),
    latencyCandidate: latencyStats(candLogs.map(e => e.latencyMs).filter(Boolean)),
    drifts: [],
    clean:  []
  };

  for (const [key, baseEntries] of baseIdx.entries()) {
    const candEntries = candIdx.get(key);
    if (!candEntries || !candEntries.length) {
      report.summary.missingInCandidate++;
      report.summary.totalDrifts++;
      report.drifts.push({ type: 'MISSING_IN_CANDIDATE', endpoint: key });
      continue;
    }

    const pairs = Math.min(baseEntries.length, candEntries.length);
    for (let i = 0; i < pairs; i++) {
      const b = baseEntries[i];
      const c = candEntries[i];

      if (c.status === 0) {
        report.summary.replayErrors++;
        report.summary.totalDrifts++;
        report.drifts.push({ type: 'REPLAY_ERROR', endpoint: key, candidateId: c.id, error: c.error });
        continue;
      }

      const issues = [];

      if (!ignoreSet.has(b.status) && b.status !== c.status) {
        issues.push({ type: 'STATUS_MISMATCH', baseline: b.status, candidate: c.status });
        report.summary.statusMismatch++;
      }

      if (normStr(b.resBody) !== normStr(c.resBody)) {
        issues.push({ type: 'BODY_DIFF', baselineNorm: normStr(b.resBody).slice(0, 300), candidateNorm: normStr(c.resBody).slice(0, 300) });
        report.summary.bodyDiff++;
      }

      const bl = b.latencyMs || 0;
      const cl = c.latencyMs || 0;
      const delta = cl - bl;

      if (delta > latencyThreshold) {
        issues.push({ type: 'LATENCY_EXCEEDED', baselineMs: bl, candidateMs: cl, deltaMs: delta, thresholdMs: latencyThreshold });
        report.summary.latencyExceeded++;
      }

      if (latencyRatio !== null && bl > 0 && cl / bl > latencyRatio) {
        issues.push({ type: 'LATENCY_RATIO', baselineMs: bl, candidateMs: cl, ratio: (cl / bl).toFixed(2), threshold: latencyRatio });
        report.summary.latencyRatio++;
      }

      if (issues.length) { report.summary.totalDrifts++; report.drifts.push({ endpoint: key, baselineId: b.id, candidateId: c.id, issues }); }
      else report.clean.push({ endpoint: key, status: c.status, latencyMs: c.latencyMs });
    }
  }

  for (const key of candIdx.keys()) {
    if (!baseIdx.has(key)) { report.summary.newInCandidate++; report.drifts.push({ type: 'NEW_IN_CANDIDATE', endpoint: key }); }
  }

  await fs.ensureDir(reportDir);
  const ts         = Date.now();
  const reportFile = path.join(reportDir, `drift-${ts}.json`);
  const summaryFile= path.join(reportDir, `drift-${ts}-summary.jsonl`);

  await fs.writeJson(reportFile, report, { spaces: 2 });
  await fs.writeFile(summaryFile, report.drifts.map(d => JSON.stringify(d)).join('\n') + '\n', 'utf8');

  logger.info(report.summary, 'drift analysis complete');
  logger.info({ reportFile, summaryFile }, 'reports saved');
  return report;
}

module.exports = { analyzeDrift };
