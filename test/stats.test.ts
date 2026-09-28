import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, dayBars, sessionTurns, type SessionEventRecord } from '../src/pure/stats.ts';

const record = (over: Partial<SessionEventRecord>): SessionEventRecord =>
  ({
    v: 1,
    sessionId: 's1',
    at: '2026-09-15T02:00:00.000Z',
    day: '2026-09-15',
    modelId: 'deepseek-v4-pro',
    provider: 'deepseek',
    turn: 1,
    buckets: { uncachedInput: 100, cacheRead: 900, output: 50, cacheWrite: 0 },
    ...over,
  }) as SessionEventRecord;

test('sessions accumulate across records; days and models get their slices', () => {
  const result = aggregate([
    record({}),
    record({ turn: 2, at: '2026-09-15T03:00:00.000Z' }),
    record({ sessionId: 's2', day: '2026-09-16', at: '2026-09-16T02:00:00.000Z' }),
  ]);
  assert.equal(result.sessions.length, 2);
  assert.equal(result.byDay.length, 2);
  assert.equal(result.byDay[0]!.sessions, 1);
  assert.equal(result.byDay[0]!.events, 2);
  assert.equal(result.models[0]!.modelId, 'deepseek-v4-pro');
  assert.equal(result.models[0]!.events, 3);
  assert.equal(result.totalTokens, 1050 * 3);
});

test('top sessions sort by cost, unpriced sessions still count tokens', () => {
  const result = aggregate([
    record({ sessionId: 'priced', costMicros: 5_000_000, currency: 'CNY' }),
    record({ sessionId: 'free', modelId: 'gpt-99', costMicros: undefined, currency: undefined }),
  ]);
  assert.equal(result.topSessions[0]!.sessionId, 'priced');
  const free = result.sessions.find((s) => s.sessionId === 'free')!;
  assert.equal(free.costMicros, 0);
  assert.equal(free.tokens, 1050);
  assert.equal(free.currencies.length, 0);
});

test('distinct turns are derived, not accumulated', () => {
  assert.equal(sessionTurns([record({ turn: 1 }), record({ turn: 1 }), record({ turn: 3 })], 's1'), 2);
});

test('day bars normalize to the peak day', () => {
  const result = aggregate([
    record({}),
    record({ day: '2026-09-16', at: '2026-09-16T00:00:00.000Z', turn: 9 }),
    record({ day: '2026-09-16', at: '2026-09-16T01:00:00.000Z', turn: 10 }),
  ]);
  const bars = dayBars(result.byDay, 14);
  assert.equal(bars.length, 2);
  assert.equal(bars[0]!.share, 0.5); // 1150 tokens vs the 09-16 peak of 2300
});

test('mixed currencies split day slices instead of blending', () => {
  const result = aggregate([
    record({}),
    record({ day: '2026-09-15', at: '2026-09-15T05:00:00.000Z', costMicros: 100, currency: 'USD' }),
  ]);
  const day15 = result.byDay.filter((day) => day.day === '2026-09-15');
  assert.equal(day15.length, 2);
  assert.deepEqual(day15.map((day) => day.currency).sort(), ['USD', 'none']);
});

test('skipped lines ride along for the report', () => {
  assert.equal(aggregate([record({})], 4).skippedLines, 4);
});
