import { sumMicros, type Micros } from '../money.ts';
import { emptyBuckets, mergeBuckets, totalTokens, type TokenBuckets } from '../pricing/cost.ts';

/**
 * One per-session usage observation, appended to the session-insights sidecar
 * (NOT the cost ledger — that one bills money; this one counts activity, so it
 * accepts events even when no price row matches and keeps them token-only).
 */
export interface SessionEventRecord {
  v: 1;
  sessionId: string;
  at: string; // ISO timestamp
  day: string; // YYYY-MM-DD (UTC), denormalized for cheap daily aggregation
  modelId: string;
  provider?: string;
  turn: number; // the turn this event belongs to; distinct turns are derived
  buckets: TokenBuckets;
  costMicros?: Micros; // present only when the model was priceable
  currency?: string;
}

export interface SessionStats {
  sessionId: string;
  firstAt: string;
  lastAt: string;
  events: number;
  tokens: number;
  buckets: TokenBuckets;
  costMicros: Micros; // 0 when nothing was priceable
  currencies: string[];
  models: string[];
}

export interface DaySlice {
  day: string;
  sessions: number;
  events: number;
  tokens: number;
  costMicros: Micros;
  currency: string;
}

export interface InsightsAggregate {
  sessions: SessionStats[];
  topSessions: SessionStats[]; // descending by cost
  byDay: DaySlice[]; // ascending by day
  models: { modelId: string; events: number; tokens: number; costMicros: Micros }[]; // descending by cost
  totalTokens: number;
  totalCostMicros: Micros;
  skippedLines: number;
}

const MODEL_LIMIT = 12;

function byDayAsc(a: DaySlice, b: DaySlice): number {
  return a.day < b.day ? -1 : a.day > b.day ? 1 : a.currency.localeCompare(b.currency);
}

/**
 * Cross-session aggregation over sidecar records. Days are split per currency
 * only when records actually disagree — a single-currency history produces one
 * series, and a mixed one produces interleaved slices rather than a blend.
 */
export function aggregate(records: SessionEventRecord[], skippedLines = 0): InsightsAggregate {
  const sessions = new Map<string, SessionStats>();
  const days = new Map<string, DaySlice>();
  const turnsBySession = new Map<string, Set<number>>();
  const models = new Map<string, { events: number; tokens: number; costMicros: Micros }>();

  for (const record of records) {
    if (typeof record.sessionId !== 'string' || typeof record.at !== 'string') continue;
    let stats = sessions.get(record.sessionId);
    if (!stats) {
      stats = {
        sessionId: record.sessionId,
        firstAt: record.at,
        lastAt: record.at,
        events: 0,
        tokens: 0,
        buckets: emptyBuckets(),
        costMicros: 0,
        currencies: [],
        models: [],
      };
      sessions.set(record.sessionId, stats);
      turnsBySession.set(record.sessionId, new Set());
    }
    stats.lastAt = stats.lastAt > record.at ? stats.lastAt : record.at;
    stats.firstAt = stats.firstAt < record.at ? stats.firstAt : record.at;
    stats.events++;
    stats.tokens += totalTokens(record.buckets);
    stats.buckets = mergeBuckets(stats.buckets, record.buckets);
    if (typeof record.costMicros === 'number' && record.costMicros > 0) stats.costMicros = sumMicros(stats.costMicros, record.costMicros);
    if (record.currency && !stats.currencies.includes(record.currency)) stats.currencies.push(record.currency);
    if (record.modelId && !stats.models.includes(record.modelId)) stats.models.push(record.modelId);
    if (typeof record.turn === 'number') turnsBySession.get(record.sessionId)!.add(record.turn);
    const currency = record.currency ?? 'none';
    const dayKey = `${record.day}|${currency}`;
    let day = days.get(dayKey);
    if (!day) {
      day = { day: record.day, sessions: 0, events: 0, tokens: 0, costMicros: 0, currency };
      days.set(dayKey, day);
    }
    day.events++;
    day.tokens += totalTokens(record.buckets);
    if (record.costMicros) day.costMicros = sumMicros(day.costMicros, record.costMicros);

    if (record.modelId) {
      let model = models.get(record.modelId);
      if (!model) {
        model = { events: 0, tokens: 0, costMicros: 0 };
        models.set(record.modelId, model);
      }
      model.events++;
      model.tokens += totalTokens(record.buckets);
      if (record.costMicros) model.costMicros = sumMicros(model.costMicros, record.costMicros);
    }
  }

  for (const [sessionId, stats] of sessions) stats.models = stats.models.slice(0, MODEL_LIMIT);
  const sessionList = [...sessions.values()];
  for (const day of days.values()) {
    day.sessions = new Set(records.filter((r) => r.day === day.day && (r.currency ?? 'none') === day.currency).map((r) => r.sessionId)).size;
  }
  return {
    sessions: sessionList,
    topSessions: [...sessionList].sort((a, b) => b.costMicros - a.costMicros),
    byDay: [...days.values()].sort(byDayAsc),
    models: [...models.entries()]
      .map(([modelId, value]) => ({ modelId, ...value }))
      .sort((a, b) => b.costMicros - a.costMicros),
    totalTokens: sessionList.reduce((total, stats) => total + stats.tokens, 0),
    totalCostMicros: sumMicros(...sessionList.map((stats) => stats.costMicros)),
    skippedLines,
  };
}

/** Bars are computed, not styled: the host only ships numbers, the client decides pixels. */
export function dayBars(byDay: DaySlice[], recentDays: number): { day: string; tokens: number; share: number }[] {
  const recent = byDay.slice(-recentDays);
  const peak = Math.max(1, ...recent.map((day) => day.tokens));
  return recent.map((day) => ({ day: day.day, tokens: day.tokens, share: day.tokens / peak }));
}

export function sessionTurns(records: SessionEventRecord[], sessionId: string): number {
  return new Set(records.filter((record) => record.sessionId === sessionId).map((record) => record.turn)).size;
}
