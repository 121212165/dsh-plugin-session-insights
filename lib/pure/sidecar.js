function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parseRecordLine(line) {
    const text = line.trim();
    if (!text)
        return null;
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        return null;
    }
    if (!isRecord(value))
        return null;
    if (value.v !== 1)
        return null;
    if (typeof value.sessionId !== 'string' || typeof value.at !== 'string' || typeof value.day !== 'string')
        return null;
    if (Number.isNaN(Date.parse(value.at)))
        return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.day))
        return null;
    if (typeof value.modelId !== 'string')
        return null;
    if (!isRecord(value.buckets))
        return null;
    for (const key of ['uncachedInput', 'output', 'cacheRead', 'cacheWrite']) {
        const n = value.buckets[key];
        if (n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n < 0))
            return null;
    }
    if (value.costMicros !== undefined && (typeof value.costMicros !== 'number' || !Number.isFinite(value.costMicros) || value.costMicros < 0))
        return null;
    return value;
}
export function parseJsonl(content) {
    let skipped = 0;
    const records = [];
    for (const line of content.split(/\r?\n/)) {
        const record = parseRecordLine(line);
        if (record)
            records.push(record);
        else if (line.trim())
            skipped++;
    }
    return { records, skipped };
}
//# sourceMappingURL=sidecar.js.map