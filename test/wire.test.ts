/**
 * Wire-level (assembly layer) tests for session-insights: mount the real apply()
 * against a scripted cordis context, drive session/event assistant messages
 * end to end through the sidecar store, and exercise /insights and
 * /insights-export including the corrupted-line and error paths.
 * Template: dsh-plugin-quota/test/harness.ts.
 * @module test/wire
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

interface CapturedCommand { name: string; handler: (args?: { rawInput?: string }) => unknown }
interface Listener { event: string; callback: (session: unknown, event: unknown) => unknown }

type Apply = (ctx: unknown, config: Record<string, unknown>) => void;

interface Fixture {
  commands: CapturedCommand[];
  listeners: Listener[];
  dataDir: string;
  exportDir: string;
}

function fixture(): Fixture {
  const commands: CapturedCommand[] = [];
  const listeners: Listener[] = [];
  const dataDir = mkdtempSync(join(tmpdir(), 'insights-wire-data-'));
  const exportDir = mkdtempSync(join(tmpdir(), 'insights-wire-export-'));
  after(() => {
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(exportDir, { recursive: true, force: true });
  });
  return { commands, listeners, dataDir, exportDir };
}

async function mount(f: Fixture, over: Record<string, unknown> = {}): Promise<void> {
  const ctx = {
    logger() { return { info() {}, warn() {} }; },
    on(event: string, callback: (session: unknown, event: unknown) => unknown) { f.listeners.push({ event, callback }); },
    commands: { register(definition: CapturedCommand) { f.commands.push(definition); } },
  };
  const { apply } = (await import('../src/plugin.ts')) as unknown as { apply: Apply };
  await Promise.resolve(apply(ctx, {
    enabled: true,
    dataDir: f.dataDir,
    exportDir: f.exportDir,
    topSessions: 10,
    recentDays: 14,
    prices: [],
    ...over,
  }));
}

function emitUsage(f: Fixture, sessionId: string, model: string, provider = 'deepseek'): void {
  const listener = f.listeners.find((candidate) => candidate.event === 'session/event');
  if (!listener) throw new Error('session/event listener was never registered');
  listener.callback(
    { id: sessionId },
    {
      type: 'assistant/message',
      data: {
        turn: 1,
        usage: { inputTokens: 120, outputTokens: 30, cacheReadTokens: 40 },
        message: { source: { provider, model } },
      },
    },
  );
}

async function run(f: Fixture, commandName: string, rawInput?: string): Promise<{ kind: string; text: string }> {
  const found = f.commands.find((candidate) => candidate.name === commandName);
  if (!found) throw new Error(`command ${commandName} was never registered`);
  return (await found.handler({ rawInput })) as { kind: string; text: string };
}

test('mount wires the listener and both commands', async () => {
  const f = fixture();
  await mount(f);
  assert.ok(f.listeners.some((candidate) => candidate.event === 'session/event'), 'session/event listener registered');
  assert.ok(f.commands.some((candidate) => candidate.name === 'insights'), '/insights registered');
  assert.ok(f.commands.some((candidate) => candidate.name === 'insights-export'), '/insights-export registered');
  assert.equal(f.commands.length, 2, `exactly two commands: ${f.commands.map((candidate) => candidate.name).join(', ')}`);
  assert.equal(readdirSync(f.dataDir).length, 0, 'no sidecar files before events');
});

test('usage events land in the sidecar and /insights renders sessions, models, and cost', async () => {
  const f = fixture();
  await mount(f);
  emitUsage(f, 'sess-aaaa', 'deepseek-v4-pro');
  emitUsage(f, 'sess-bbbb', 'mystery-model');

  const files = readdirSync(f.dataDir);
  assert.equal(files.length, 1, `one monthly file: ${files}`);
  assert.ok(files[0]!.startsWith('insights-'), 'monthly sidecar naming');
  const line = readFileSync(join(f.dataDir, files[0]!), 'utf8').trim().split(/\r?\n/)[0]!;
  assert.ok(line.includes('"modelId":"deepseek-v4-pro"'), `first record: ${line}`);

  const text = (await run(f, 'insights')).text;
  assert.ok(text.includes('共 2 个会话'), `sessions counted: ${text}`);
  assert.ok(text.includes('deepseek-v4-pro'), 'priced model listed');
  assert.ok(text.includes('mystery-model'), 'unpriced model still listed');
});

test('a corrupted sidecar line is skipped with a visible warning', async () => {
  const f = fixture();
  await mount(f);
  emitUsage(f, 'sess-cccc', 'deepseek-v4-pro');
  const file = readdirSync(f.dataDir).join();
  appendFileSync(join(f.dataDir, file), 'broken-json\n', 'utf8');
  const text = (await run(f, 'insights')).text;
  assert.ok(text.includes('⚠ 1 行损坏被跳过'), `skip warning present: ${text}`);
});

test('the empty store path answers without crashing', async () => {
  const f = fixture();
  await mount(f);
  const text = (await run(f, 'insights')).text;
  assert.ok(text.includes('还没有任何会话记录'), `empty answer: ${text}`);
});

test('insights-export writes a CSV and rejects bad month shapes', async () => {
  const f = fixture();
  await mount(f);
  const bad = await run(f, 'insights-export', '2026-1');
  assert.equal(bad.kind, 'error');
  assert.ok(bad.text.includes('YYYY-MM'), `bad month message: ${bad.text}`);

  emitUsage(f, 'sess-dddd', 'deepseek-v4-pro');
  const good = await run(f, 'insights-export');
  assert.equal(good.kind, 'success');
  const files = readdirSync(f.exportDir);
  assert.equal(files.length, 1);
  assert.ok(files[0]!.endsWith('.csv'), `csv written: ${files}`);
});

test('disabled config mounts nothing', async () => {
  const f = fixture();
  const ctx = {
    logger() { return { info() {}, warn() {} }; },
    on(_event: string, _callback: never) { assert.fail('listener registered while disabled'); },
    commands: { register() { assert.fail('command registered while disabled'); } },
  };
  void f;
  const { apply } = (await import('../src/plugin.ts')) as unknown as { apply: Apply };
  await Promise.resolve(apply(ctx, { enabled: false, dataDir: f.dataDir, exportDir: f.exportDir, topSessions: 10, recentDays: 14, prices: [] }));
});
