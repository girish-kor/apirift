'use strict';

const fs       = require('fs-extra');
const path     = require('path');
const readline = require('readline');

/**
 * appendLog — append one JSONL line to a file (creates dirs automatically).
 */
async function appendLog(file, data) {
  await fs.ensureDir(path.dirname(file));
  await fs.appendFile(file, JSON.stringify(data) + '\n', 'utf8');
}

/**
 * readLogs — stream-parse a JSONL file into an array.
 * Throws a descriptive error on malformed lines.
 */
async function readLogs(file) {
  await fs.ensureFile(file);
  return new Promise((resolve, reject) => {
    const entries = [];
    let lineNum   = 0;
    const rl = readline.createInterface({
      input: fs.createReadStream(file, 'utf8'),
      crlfDelay: Infinity
    });
    rl.on('line', line => {
      lineNum++;
      if (!line.trim()) return;
      try { entries.push(JSON.parse(line)); }
      catch (err) { rl.close(); reject(new Error(`Malformed JSONL at line ${lineNum}: ${line.slice(0, 80)}`)); }
    });
    rl.on('close', () => resolve(entries));
    rl.on('error', err => { rl.close(); reject(err); });
  });
}

/**
 * rotateLogs — trim a JSONL file to its last N entries.
 */
async function rotateLogs(file, keepLast = 10000) {
  const entries = await readLogs(file);
  if (entries.length <= keepLast) return;
  const trimmed = entries.slice(-keepLast);
  await fs.writeFile(file, trimmed.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf8');
}

module.exports = { appendLog, readLogs, rotateLogs };
