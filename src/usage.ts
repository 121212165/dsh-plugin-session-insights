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

export function toBuckets(usage: RawUsage, inputIncludesCache = false): TokenBuckets {
  const cacheRead = Math.max(0, usage.cacheReadTokens ?? 0);
  const rawInput = Math.max(0, usage.inputTokens ?? 0);
  return {
    uncachedInput: inputIncludesCache ? Math.max(0, rawInput - cacheRead) : rawInput,
    cacheRead,
    output: Math.max(0, usage.outputTokens ?? 0),
    cacheWrite: Math.max(0, usage.cacheWriteTokens ?? 0),
  };
}
