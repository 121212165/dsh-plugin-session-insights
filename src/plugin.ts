/**
 * dsh wiring for the session-insights plugin.
 *
 * Accounting rides the same event surface price-aware verified (session/event
 * assistant/message usage + agent/request model capture), but the sidecar is
 * token-first: unpriced models still count, cost rides along when known.
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { join } from 'node:path';

import type {} from '@deepseek-ai/dsh-commands';
import type {} from '@deepseek-ai/dsh-session';
import { SidecarStore, expandHome } from './sidecar-store.ts';
import { aggregate, dayBars, type SessionEventRecord } from './pure/stats.ts';
import { toCsv } from './pure/csv.ts';
import { parseJsonl } from './pure/sidecar.ts';
import { resolveModel } from './pricing/resolve.ts';
import { toBuckets, type RawUsage } from './usage.ts';
import { DEEPSEEK_CATALOG, mergeCatalog, type PriceCatalog, type PriceEntry } from './pricing/catalog.ts';
import { costOf } from './pricing/cost.ts';

export const name = 'session-insights';
export const inject = ['commands', 'llm', 'sessions'];

export interface Config {
  enabled: boolean;
  dataDir?: string;
  exportDir?: string;
  topSessions: number;
  recentDays: number;
  prices: PriceEntry[];
}

export const Config = Schema.object({
  enabled: Schema.boolean().default(true),
  dataDir: Schema.string(),
  exportDir: Schema.string(),
  topSessions: Schema.natural().default(10),
  recentDays: Schema.natural().default(14),
  prices: Schema.array(
    Schema.object({
      id: Schema.string(),
      currency: Schema.union([Schema.const('CNY'), Schema.const('USD'), Schema.const('EUR')]).default('CNY'),
      perMillion: Schema.object({
        cacheRead: Schema.number(),
        uncachedInput: Schema.number(),
        output: Schema.number(),
      }),
      peakMultiplier: Schema.number(),
      contextTokens: Schema.natural().default(1_000_000),
      maxOutputTokens: Schema.natural().default(256_000),
      aliases: Schema.array(Schema.string()).default([]),
      note: Schema.string().default(''),
    }),
  ).default([]),
});

interface ModelRef {
  id: string;
  provider?: string;
}

const dayOf = (iso: string): string => iso.slice(0, 10);

export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger('session-insights');
  if (!config.enabled) return void log.info('disabled by config');

  const catalog: PriceCatalog = mergeCatalog(DEEPSEEK_CATALOG, config.prices);
  const store = new SidecarStore(config.dataDir);
  const exportDir = config.exportDir ? expandHome(config.exportDir) : store.dataDir;
  const modelByAgent = new Map<string, ModelRef>();

  ctx.on('agent/request', (payload, next) =>
    next().then((callConfig) => {
      const shape = callConfig as unknown as { provider?: string; model?: string };
      if (shape.model) modelByAgent.set(agentKey(payload.agent), { id: shape.model, provider: shape.provider });
      return callConfig;
    }),
  );

  ctx.on('session/event', (session, event) => {
    if (event.type !== 'assistant/message') return;
    const usage = event.data.usage as RawUsage | undefined;
    if (!usage) return;
    const sessionId = String((session as { id?: unknown }).id ?? 'session');
    const model = modelByAgent.get(agentKey(session)) ?? { id: 'unknown' };
    const buckets = toBuckets(usage);
    const at = new Date().toISOString();
    let costMicros: number | undefined;
    let currency: string | undefined;
    const resolution = resolveModel(model.id, catalog, { provider: model.provider });
    if (resolution.kind === 'known') {
      const cost = costOf(buckets, resolution.entry, { at: new Date(), rules: {} });
      costMicros = cost.micros;
      currency = cost.currency;
    }
    const record: SessionEventRecord = {
      v: 1,
      sessionId,
      at,
      day: dayOf(at),
      modelId: model.id,
      provider: model.provider,
      turn: event.data.turn,
      buckets,
      costMicros,
      currency,
    };
    try {
      store.append(record);
    } catch (error) {
      log.warn(`sidecar append failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  ctx.on('session/disposed', (session) => {
    modelByAgent.delete(String((session as { id?: unknown }).id ?? ''));
  });

  ctx.commands.register({
    name: 'insights',
    description: '跨会话统计：每日趋势、最贵会话、模型分布',
    handler: () => {
      const all = store.readAll();
      const insights = aggregate(all.records, all.skipped);
      if (!insights.sessions.length) return { kind: 'success', text: '还没有任何会话记录。' };
      const bars = dayBars(insights.byDay, config.recentDays)
        .map((day) => `${day.day}  ${'█'.repeat(Math.max(1, Math.round(day.share * 24)))} ${Math.round(day.tokens / 1000)}k`)
        .join('\n');
      const top = insights.topSessions
        .slice(0, config.topSessions)
        .map((session, index) => `${index + 1}. ${session.sessionId.slice(0, 8)}…  ${session.events} 次调用 · ${Math.round(session.tokens / 1000)}k tok${session.costMicros > 0 ? ` · ${(session.costMicros / 1e6).toFixed(4)} ${session.currencies.join('/')}` : ''}`)
        .join('\n');
      const models = insights.models
        .slice(0, 8)
        .map((model) => `${model.modelId.padEnd(28)} ${model.events} 次 · ${Math.round(model.tokens / 1000)}k tok`)
        .join('\n');
      const skipNote = insights.skippedLines ? `\n⚠ ${insights.skippedLines} 行损坏被跳过` : '';
      return {
        kind: 'success',
        text: `共 ${insights.sessions.length} 个会话 · ${Math.round(insights.totalTokens / 1000)}k tokens\n\n每日趋势（近 ${config.recentDays} 天）:\n${bars}\n\n最贵会话:\n${top}\n\n模型分布:\n${models}${skipNote}`,
      };
    },
  });

  ctx.commands.register({
    name: 'insights-export',
    description: '导出跨会话明细 CSV：/insights-export 2026-09（缺省全部）',
    input: { hint: '[YYYY-MM]' },
    handler: async () => {
      const all = store.readAll();
      const records = all.records;
      if (!records.length) return { kind: 'error', text: '还没有任何会话记录。' };
      const file = join(exportDir, 'session-insights.csv');
      const { mkdirSync, writeFileSync } = await import('node:fs');
      mkdirSync(exportDir, { recursive: true });
      writeFileSync(file, toCsv(records), 'utf8');
      return { kind: 'success', text: `已导出 ${records.length} 条 -> ${file}` };
    },
  });

  log.info(`mounted · dataDir=${store.dataDir}`);
}


function agentKey(agent: unknown): string {
  const value = agent as { id?: string; session?: { id?: string } } | undefined;
  return String(value?.id ?? value?.session?.id ?? 'agent');
}

