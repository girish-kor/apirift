'use strict';

const axios  = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { readLogs, appendLog } = require('../storage/fileStore');

const SKIP_REQ_HEADERS  = new Set(['host', 'content-length', 'transfer-encoding', 'connection']);
const DEFAULT_TIMEOUT   = 15000;

/**
 * replayLogs — replay captured JSONL entries against a target.
 *
 * @param {object}  opts
 * @param {string}  opts.input         Source JSONL file
 * @param {string}  opts.target        Base replay URL (required)
 * @param {string}  opts.output        Results JSONL file
 * @param {number}  opts.delayMs       Inter-request delay
 * @param {number}  opts.concurrency   Parallel workers (1 = sequential)
 * @param {number}  opts.timeoutMs     Per-request axios timeout
 * @param {boolean} opts.dryRun        Log what would be replayed, do not send
 */
async function replayLogs({
  input       = 'logs/logs.jsonl',
  target,
  output      = 'logs/replay.jsonl',
  delayMs     = 0,
  concurrency = 1,
  timeoutMs   = DEFAULT_TIMEOUT,
  dryRun      = false
} = {}) {
  if (!target) throw new Error('--target <url> is required for replay mode');

  const logs = await readLogs(input);
  if (!logs.length) { logger.warn('No log entries found. Nothing to replay.'); return []; }

  logger.info({ count: logs.length, target, concurrency, dryRun }, 'starting replay');

  if (dryRun) {
    logs.forEach(e => logger.info({ method: e.method, url: e.url }, '[dry-run] would replay'));
    return [];
  }

  const results    = [];
  const targetBase = target.replace(/\/$/, '');

  async function replayOne(entry) {
    const url     = `${targetBase}${entry.url}`;
    const method  = (entry.method || 'GET').toLowerCase();
    const headers = Object.fromEntries(
      Object.entries(entry.reqHeaders || {})
        .filter(([k]) => !SKIP_REQ_HEADERS.has(k.toLowerCase()))
    );
    const start = Date.now();
    let status, resBody, error;

    try {
      const resp = await axios({ method, url, data: entry.reqBody || undefined, headers, validateStatus: () => true, timeout: timeoutMs, maxRedirects: 5 });
      status  = resp.status;
      resBody = typeof resp.data === 'object' ? JSON.stringify(resp.data) : String(resp.data ?? '');
    } catch (err) {
      error   = err.message;
      status  = 0;
      resBody = null;
    }

    const latencyMs = Date.now() - start;
    const result = { id: uuidv4(), originalId: entry.id, timestamp: new Date().toISOString(), method: entry.method, url: entry.url, status, resBody, latencyMs, error: error || null };
    await appendLog(output, result);
    logger[status === 0 ? 'warn' : 'info']({ method: result.method, url: result.url, status, latencyMs, error: error || undefined }, 'replayed');
    return result;
  }

  if (concurrency <= 1) {
    for (const entry of logs) {
      results.push(await replayOne(entry));
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }
  } else {
    let i = 0;
    const worker = async () => {
      while (i < logs.length) {
        const entry = logs[i++];
        results.push(await replayOne(entry));
        if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, logs.length) }, worker));
  }

  logger.info({ output, total: results.length, errors: results.filter(r => r.status === 0).length }, 'replay complete');
  return results;
}

module.exports = { replayLogs };
