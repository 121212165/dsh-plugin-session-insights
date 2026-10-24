import type { TokenBuckets } from './pricing/cost.ts';
/** dsh's assistant/message usage counts are disjoint by contract (same as
 * price-aware): inputTokens is uncached input only; reasoning is inside output. */
export interface RawUsage {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
}
export declare function toBuckets(usage: RawUsage, inputIncludesCache?: boolean): TokenBuckets;
//# sourceMappingURL=usage.d.ts.map