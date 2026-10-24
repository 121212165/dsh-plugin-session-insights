export function toBuckets(usage, inputIncludesCache = false) {
    const cacheRead = Math.max(0, usage.cacheReadTokens ?? 0);
    const rawInput = Math.max(0, usage.inputTokens ?? 0);
    return {
        uncachedInput: inputIncludesCache ? Math.max(0, rawInput - cacheRead) : rawInput,
        cacheRead,
        output: Math.max(0, usage.outputTokens ?? 0),
        cacheWrite: Math.max(0, usage.cacheWriteTokens ?? 0),
    };
}
//# sourceMappingURL=usage.js.map