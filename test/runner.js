'use strict';

const assert = require('assert');
const path   = require('path');
const os     = require('os');
const fs     = require('fs-extra');

let passed = 0, failed = 0;

async function test(name, fn) {
  try   { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
}

async function run() {
  console.log('\napirift unit tests\n');

  // ── mask ──────────────────────────────────────────────────────────────────
  console.log('mask.js');
  const { maskHeaders, maskBody } = require('../src/utils/mask');

  await test('redacts authorization', () => {
    const out = maskHeaders({ authorization: 'Bearer s', 'content-type': 'application/json' });
    assert.strictEqual(out.authorization, '[REDACTED]');
    assert.strictEqual(out['content-type'], 'application/json');
  });
  await test('redacts cookie', () => {
    assert.strictEqual(maskHeaders({ cookie: 'x' }).cookie, '[REDACTED]');
  });
  await test('redacts extra headers', () => {
    assert.strictEqual(maskHeaders({ 'x-custom': 'v' }, ['x-custom'])['x-custom'], '[REDACTED]');
  });
  await test('maskBody redacts specified fields', () => {
    const out = maskBody({ password: 'secret', name: 'Alice' }, ['password']);
    assert.strictEqual(out.password, '[REDACTED]');
    assert.strictEqual(out.name, 'Alice');
  });
  await test('maskHeaders handles null gracefully', () => {
    assert.deepStrictEqual(maskHeaders(null), {});
    assert.deepStrictEqual(maskHeaders(undefined), {});
  });

  // ── normalize ─────────────────────────────────────────────────────────────
  console.log('\nnormalize.js');
  const { normalize } = require('../src/utils/normalize');

  await test('removes volatile keys', () => {
    const out = normalize({ id: '1', name: 'Alice', createdAt: 'x', role: 'admin' });
    assert.strictEqual(out.id, undefined);
    assert.strictEqual(out.createdAt, undefined);
    assert.strictEqual(out.name, 'Alice');
  });
  await test('recursively strips nested objects', () => {
    const out = normalize({ user: { id: 'u1', name: 'Bob', updatedAt: 'x' } });
    assert.strictEqual(out.user.id, undefined);
    assert.strictEqual(out.user.name, 'Bob');
  });
  await test('normalizes arrays', () => {
    const out = normalize([{ id: '1', val: 'a' }, { id: '2', val: 'b' }]);
    assert.strictEqual(out[0].id, undefined);
    assert.strictEqual(out[0].val, 'a');
  });
  await test('parses string body', () => {
    const out = normalize(JSON.stringify({ id: 'x', name: 'Alice' }));
    assert.strictEqual(out.id, undefined);
    assert.strictEqual(out.name, 'Alice');
  });
  await test('accepts extra volatile keys', () => {
    const out = normalize({ sessionToken: 'abc', role: 'admin' }, ['sessionToken']);
    assert.strictEqual(out.sessionToken, undefined);
    assert.strictEqual(out.role, 'admin');
  });

  // ── fileStore ─────────────────────────────────────────────────────────────
  console.log('\nfileStore.js');
  const { appendLog, readLogs, rotateLogs } = require('../src/storage/fileStore');
  const tmp = path.join(os.tmpdir(), `apirift-test-${Date.now()}.jsonl`);

  await test('appendLog + readLogs round-trips', async () => {
    await appendLog(tmp, { id:'1', timestamp:'x', method:'GET',  url:'/a', status:200, latencyMs:10 });
    await appendLog(tmp, { id:'2', timestamp:'x', method:'POST', url:'/b', status:201, latencyMs:20 });
    const entries = await readLogs(tmp);
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].url, '/a');
    assert.strictEqual(entries[1].url, '/b');
  });
  await test('readLogs returns [] for empty file', async () => {
    const empty = path.join(os.tmpdir(), `apirift-empty-${Date.now()}.jsonl`);
    assert.deepStrictEqual(await readLogs(empty), []);
  });
  await test('rotateLogs trims to keepLast', async () => {
    const rotFile = path.join(os.tmpdir(), `apirift-rot-${Date.now()}.jsonl`);
    for (let i = 0; i < 10; i++) {
      await appendLog(rotFile, { id: String(i), timestamp:'x', method:'GET', url:'/x', status:200, latencyMs:5 });
    }
    await rotateLogs(rotFile, 5);
    const trimmed = await readLogs(rotFile);
    assert.strictEqual(trimmed.length, 5);
    assert.strictEqual(trimmed[0].id, '5');
  });

  // ── stats ─────────────────────────────────────────────────────────────────
  console.log('\nstats.js');
  const { latencyStats } = require('../src/utils/stats');

  await test('computes all percentiles correctly', () => {
    const s = latencyStats([10,20,30,40,50,60,70,80,90,100]);
    assert.strictEqual(s.min, 10);
    assert.strictEqual(s.max, 100);
    assert.strictEqual(s.mean, 55);
    assert.strictEqual(s.p50, 50);
    assert.strictEqual(s.p90, 90);
    assert.strictEqual(s.p99, 100);
  });
  await test('returns {} for empty input', () => {
    assert.deepStrictEqual(latencyStats([]), {});
  });

  // ── schema/validate ───────────────────────────────────────────────────────
  console.log('\nschema/validate.js');
  const { validateEntry, validateAll } = require('../src/schema/validate');

  await test('validates a correct entry', () => {
    assert.strictEqual(validateEntry({ id:'x', timestamp:'y', method:'GET', url:'/a', status:200, latencyMs:10 }).length, 0);
  });
  await test('rejects missing required fields', () => {
    assert.ok(validateEntry({ url: '/a' }).length > 0);
  });
  await test('rejects invalid method', () => {
    assert.ok(validateEntry({ id:'x', timestamp:'y', method:'INVALID', url:'/a', status:200, latencyMs:10 }).length > 0);
  });
  await test('validateAll counts valid and invalid', () => {
    const result = validateAll([
      { id:'1', timestamp:'y', method:'GET', url:'/a', status:200, latencyMs:5 },
      { url: '/bad' }
    ]);
    assert.strictEqual(result.valid, 1);
    assert.strictEqual(result.invalid.length, 1);
  });

  // ── analyze/diff ──────────────────────────────────────────────────────────
  console.log('\nanalyze/diff.js');
  const { analyzeDrift } = require('../src/analyze/diff');
  const rptDir   = path.join(os.tmpdir(), `apirift-rpt-${Date.now()}`);
  const baseFile = path.join(os.tmpdir(), `base-${Date.now()}.jsonl`);
  const candFile = path.join(os.tmpdir(), `cand-${Date.now()}.jsonl`);

  const BASE = { id:'b1', timestamp:'x', method:'GET', url:'/api/test', status:200, resBody:JSON.stringify({ name:'Alice' }), latencyMs:50 };
  const CLEAN= { id:'c1', timestamp:'y', method:'GET', url:'/api/test', status:200, resBody:JSON.stringify({ name:'Alice' }), latencyMs:60 };
  const DRIFT= { id:'c2', timestamp:'y', method:'GET', url:'/api/test', status:503, resBody:JSON.stringify({ error:'down' }),  latencyMs:800 };

  await test('no drift when responses match', async () => {
    await fs.writeFile(baseFile, JSON.stringify(BASE)  + '\n');
    await fs.writeFile(candFile, JSON.stringify(CLEAN) + '\n');
    const rpt = await analyzeDrift({ baseline: baseFile, candidate: candFile, reportDir: rptDir });
    assert.strictEqual(rpt.summary.totalDrifts, 0);
  });
  await test('detects STATUS_MISMATCH', async () => {
    await fs.writeFile(baseFile, JSON.stringify(BASE)  + '\n');
    await fs.writeFile(candFile, JSON.stringify(DRIFT) + '\n');
    const rpt = await analyzeDrift({ baseline: baseFile, candidate: candFile, reportDir: rptDir });
    assert.ok(rpt.summary.statusMismatch > 0);
  });
  await test('detects BODY_DIFF', async () => {
    await fs.writeFile(baseFile, JSON.stringify(BASE)  + '\n');
    await fs.writeFile(candFile, JSON.stringify(DRIFT) + '\n');
    const rpt = await analyzeDrift({ baseline: baseFile, candidate: candFile, reportDir: rptDir });
    assert.ok(rpt.summary.bodyDiff > 0);
  });
  await test('detects LATENCY_EXCEEDED', async () => {
    await fs.writeFile(baseFile, JSON.stringify(BASE)  + '\n');
    await fs.writeFile(candFile, JSON.stringify(DRIFT) + '\n');
    const rpt = await analyzeDrift({ baseline: baseFile, candidate: candFile, reportDir: rptDir, latencyThreshold: 100 });
    assert.ok(rpt.summary.latencyExceeded > 0);
  });
  await test('detects LATENCY_RATIO', async () => {
    await fs.writeFile(baseFile, JSON.stringify(BASE)  + '\n');
    await fs.writeFile(candFile, JSON.stringify(DRIFT) + '\n');
    const rpt = await analyzeDrift({ baseline: baseFile, candidate: candFile, reportDir: rptDir, latencyRatio: 2 });
    assert.ok(rpt.summary.latencyRatio > 0);
  });
  await test('detects MISSING_IN_CANDIDATE', async () => {
    const b2 = Object.assign({}, BASE, { url: '/api/other' });
    await fs.writeFile(baseFile, JSON.stringify(BASE) + '\n' + JSON.stringify(b2) + '\n');
    await fs.writeFile(candFile, JSON.stringify(CLEAN) + '\n');
    const rpt = await analyzeDrift({ baseline: baseFile, candidate: candFile, reportDir: rptDir });
    assert.ok(rpt.summary.missingInCandidate > 0);
  });
  await test('respects ignoreStatus option', async () => {
    await fs.writeFile(baseFile, JSON.stringify(BASE)  + '\n');
    await fs.writeFile(candFile, JSON.stringify(DRIFT) + '\n');
    const rpt = await analyzeDrift({ baseline: baseFile, candidate: candFile, reportDir: rptDir, ignoreStatus: [503, 200] });
    assert.strictEqual(rpt.summary.statusMismatch, 0);
  });
  await test('produces latency stats in report', async () => {
    await fs.writeFile(baseFile, JSON.stringify(BASE)  + '\n');
    await fs.writeFile(candFile, JSON.stringify(CLEAN) + '\n');
    const rpt = await analyzeDrift({ baseline: baseFile, candidate: candFile, reportDir: rptDir });
    assert.ok(rpt.latencyBaseline.mean  > 0);
    assert.ok(rpt.latencyCandidate.mean > 0);
  });

  await fs.remove(rptDir).catch(() => {});

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
