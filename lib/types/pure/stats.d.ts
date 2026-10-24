import { type Micros } from '../money.ts';
import { type TokenBuckets } from '../pricing/cost.ts';
/**
 * One per-session usage observation, appended to the session-insights sidecar
 * (NOT the cost ledger — that one bills money; this one counts activity, so it
 * accepts events even when no price row matches and keeps them token-only).
 */
export interface SessionEventRecord {
    v: 1;
    sessionId: string;
    at: string;
    day: string;
    modelId: string;
    provider?: string | undefined;
    turn: number;
    buckets: TokenBuckets;
    costMicros?: Micros | undefined;
    currency?: string | undefined;
}
export interface SessionStats {
    sessionId: string;
    firstAt: string;
    lastAt: string;
    events: number;
    tokens: number;
    buckets: TokenBuckets;
    costMicros: Micros;
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
    topSessions: SessionStats[];
    byDay: DaySlice[];
    models: {
        modelId: string;
        events: number;
        tokens: number;
        costMicros: Micros;
    }[];
    totalTokens: number;
    totalCostMicros: Micros;
    skippedLines: number;
}
/**
 * Cross-session aggregation over sidecar records. Days are split per currency
 * only when records actually disagree — a single-currency history produces one
 * series, and a mixed one produces interleaved slices rather than a blend.
 */
export declare function aggregate(records: SessionEventRecord[], skippedLines?: number): InsightsAggregate;
/** Bars are computed, not styled: the host only ships numbers, the client decides pixels. */
export declare function dayBars(byDay: DaySlice[], recentDays: number): {
    day: string;
    tokens: number;
    share: number;
}[];
export declare function sessionTurns(records: SessionEventRecord[], sessionId: string): number;
//# sourceMappingURL=stats.d.ts.map