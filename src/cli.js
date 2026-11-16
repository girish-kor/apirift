#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const _ = require('lodash');
const logger = require('./utils/logger');
const program = new Command();

program
  .name('apirift')
  .description('Deterministic API replay and drift detection engine')
  .version('1.0.0');

// ── capture ──────────────────────────────────────────────────────────────────
program
  .command('capture')
  .description('Start a transparent capturing HTTP proxy')
  .option('-p, --port <port>',         'Proxy listen port',                   '8080')
  .option('-t, --target <url>',        'Upstream target URL (required)')
  .option('-o, --output <file>',       'JSONL output file',                   'logs/logs.jsonl')
  .option('--mask-fields <fields>',    'Comma-separated request body fields to redact', '')
  .option('--extra-headers <headers>', 'Comma-separated extra header names to redact',  '')
  .option('--filter-path <regex>',     'Only capture paths matching regex')
  .option('--max-body-kb <kb>',        'Max response body to store (KB)',     '512')
  .action((opts) => {
    const { startProxy } = require('./capture/proxy');
    startProxy({
      port:        parseInt(opts.port, 10),
      target:      opts.target,
      output:      opts.output,
      maskFields:   opts.maskFields   ? opts.maskFields.split(',').map(s => s.trim())   : [],
      extraHeaders: opts.extraHeaders ? opts.extraHeaders.split(',').map(s => s.trim()) : [],
      filterPaths:  opts.filterPath   ? new RegExp(_.escapeRegExp(opts.filterPath)) : null,
      maxBodyKb:    parseInt(opts.maxBodyKb, 10)
    });
  });

// ── replay ───────────────────────────────────────────────────────────────────
program
  .command('replay')
  .description('Replay captured requests against a target')
  .option('-i, --input <file>',        'JSONL input file',                    'logs/logs.jsonl')
  .option('-t, --target <url>',        'Replay target URL (required)')
  .option('-o, --output <file>',       'JSONL results file',                  'logs/replay.jsonl')
  .option('-d, --delay <ms>',          'Delay between requests (ms)',         '0')
  .option('-c, --concurrency <n>',     'Parallel replay workers',             '1')
  .option('--timeout <ms>',            'Per-request timeout (ms)',            '15000')
  .option('--dry-run',                 'Print what would be replayed without sending')
  .action(async (opts) => {
    const { replayLogs } = require('./replay/replay');
    try {
      await replayLogs({
        input:       opts.input,
        target:      opts.target,
        output:      opts.output,
        delayMs:     parseInt(opts.delay, 10),
        concurrency: parseInt(opts.concurrency, 10),
        timeoutMs:   parseInt(opts.timeout, 10),
        dryRun:      !!opts.dryRun
      });
    } catch (err) { logger.error({ err: err.message }, 'replay failed'); process.exit(1); }
  });

// ── analyze ──────────────────────────────────────────────────────────────────
program
  .command('analyze')
  .description('Detect drift between baseline and candidate logs')
  .option('-b, --baseline <file>',     'Baseline JSONL file (required)')
  .option('-c, --candidate <file>',    'Candidate JSONL file (required)')
  .option('-r, --report-dir <dir>',    'Report output directory',             'reports')
  .option('-l, --latency <ms>',        'Absolute latency drift threshold (ms)','500')
  .option('--latency-ratio <n>',       'Flag if candidate is N× slower (e.g. 2)')
  .option('--normalize-keys <keys>',   'Extra volatile keys to strip (comma-separated)', '')
  .option('--ignore-status <codes>',   'HTTP codes to skip (comma-separated)', '')
  .action(async (opts) => {
    const { analyzeDrift } = require('./analyze/diff');
    try {
      const report = await analyzeDrift({
        baseline:         opts.baseline,
        candidate:        opts.candidate,
        reportDir:        opts.reportDir,
        latencyThreshold: parseInt(opts.latency, 10),
        latencyRatio:     opts.latencyRatio ? parseFloat(opts.latencyRatio) : null,
        normalizeKeys:    opts.normalizeKeys ? opts.normalizeKeys.split(',').map(s => s.trim()) : [],
        ignoreStatus:     opts.ignoreStatus  ? opts.ignoreStatus.split(',').map(Number)         : []
      });
      if (report.summary.totalDrifts > 0) {
        logger.warn({ totalDrifts: report.summary.totalDrifts }, 'Drift detected — exiting with code 1');
        process.exit(1);
      }
      logger.info('No drift detected.');
    } catch (err) { logger.error({ err: err.message }, 'analyze failed'); process.exit(1); }
  });

// ── validate ─────────────────────────────────────────────────────────────────
program
  .command('validate')
  .description('Validate a JSONL log file against the apirift schema')
  .requiredOption('-f, --file <file>', 'JSONL file to validate')
  .action(async (opts) => {
    const { readLogs }    = require('./storage/fileStore');
    const { validateAll } = require('./schema/validate');
    try {
      const entries = await readLogs(opts.file);
      const result  = validateAll(entries);
      logger.info({ valid: result.valid, invalid: result.invalid.length }, 'validation complete');
      if (result.invalid.length) {
        result.invalid.forEach(({ line, errors }) => logger.warn({ line, errors }, 'invalid entry'));
        process.exit(1);
      }
    } catch (err) { logger.error({ err: err.message }, 'validate failed'); process.exit(1); }
  });

// ── inspect ──────────────────────────────────────────────────────────────────
program
  .command('inspect')
  .description('Print a summary of a JSONL log file')
  .requiredOption('-f, --file <file>', 'JSONL file to inspect')
  .action(async (opts) => {
    const { readLogs }     = require('./storage/fileStore');
    const { latencyStats } = require('./utils/stats');
    try {
      const entries  = await readLogs(opts.file);
      const byStatus = {};
      const byMethod = {};
      for (const e of entries) {
        byStatus[e.status] = (byStatus[e.status] || 0) + 1;
        byMethod[e.method] = (byMethod[e.method] || 0) + 1;
      }
      logger.info({ total: entries.length, byStatus, byMethod, latency: latencyStats(entries.map(e => e.latencyMs).filter(Boolean)) }, 'log summary');
    } catch (err) { logger.error({ err: err.message }, 'inspect failed'); process.exit(1); }
  });

program.parseAsync(process.argv).catch(err => { logger.error({ err: err.message }, 'fatal'); process.exit(1); });
