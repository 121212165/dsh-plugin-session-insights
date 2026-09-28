import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SidecarStore } from '../src/sidecar-store.ts';
import { aggregate } from '../src/pure/stats.ts';

const record = {
  v: 1 as const,
  sessionId: 's1',
  at: '2026-09-15T02:00:00.000Z',
  day: '2026-09-15',
  modelId: 'deepseek-v4-pro',
  turn: 1,
  buckets: { uncachedInput: 100, cacheRead: 900, output: 50, cacheWrite: 0 },
};

test('appends split by month; reads survive a torn line and count it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'insights-'));
  const store = new SidecarStore(dir);
  store.append({ ...record });
  store.append({ ...record, at: '2026-10-01T00:00:00.000Z', day: '2026-10-01' });
  const sep = join(dir, 'insights-2026-09.jsonl');
  writeFileSync(sep, readFileSync(sep, 'utf8') + '{"v":1,"torn\n');
  const all = store.readAll();
  assert.equal(all.records.length, 2);
  assert.equal(all.skipped, 1);
  assert.equal(aggregate(all.records).sessions.length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('a missing directory reads empty; impossible-month files are ignored', () => {
  const dir = join(tmpdir(), `insights-missing-${Date.now()}`);
  const store = new SidecarStore(dir);
  assert.deepEqual(store.readAll(), { records: [], skipped: 0 });
  store.append({ ...record });
  writeFileSync(join(dir, 'insights-2026-13.jsonl'), 'x\n');
  assert.ok(existsSync(dir));
  assert.equal(store.readAll().records.length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('~ expands to home', () => {
  const store = new SidecarStore('~/.dsh/session-insights');
  assert.ok(!store.dataDir.startsWith('~'));
});
