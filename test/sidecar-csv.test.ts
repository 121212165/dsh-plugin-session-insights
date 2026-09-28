import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseJsonl, parseRecordLine } from '../src/pure/sidecar.ts';
import { toCsv } from '../src/pure/csv.ts';
import type { SessionEventRecord } from '../src/pure/stats.ts';

const line = JSON.stringify({
  v: 1,
  sessionId: 's1',
  at: '2026-09-15T02:00:00.000Z',
  day: '2026-09-15',
  modelId: 'deepseek-v4-pro',
  provider: 'deepseek',
  turn: 1,
  buckets: { uncachedInput: 100, cacheRead: 900, output: 50, cacheWrite: 0 },
  costMicros: 1200000,
  currency: 'CNY',
});

test('valid records parse; garbage, future schemas and torn writes are skipped', () => {
  const result = parseJsonl(`${line}\n{"v":2}\ntorn\n\n`);
  assert.equal(result.records.length, 1);
  assert.equal(result.skipped, 2);
});

test('a bad day string or negative number is rejected', () => {
  assert.equal(parseRecordLine(line.replace('"day":"2026-09-15"', '"day":"2026-09-1X"')), null);
  assert.equal(parseRecordLine(line.replace('"costMicros":1200000', '"costMicros":-1')), null);
});

test('csv escapes quotes and keeps unpriced rows with empty cost columns', () => {
  const record = parseRecordLine(line)! as SessionEventRecord;
  const csv = toCsv([record, { ...record, sessionId: 'a"b', costMicros: undefined, currency: undefined }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"a""b"'));
  const rows = csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n');
  assert.ok(rows[2]!.endsWith(',,1')); // empty cost + currency columns, then turn
  assert.equal(rows[0]!.split(',').length, 13);
});
