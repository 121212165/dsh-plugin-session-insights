import type { SessionEventRecord } from './stats.ts';
export type { SessionEventRecord };

/** Sidecar record parser: same tolerate-and-count philosophy as the cost ledger —
 * a torn line from a crash is skipped and counted, never fatal, never rewritten. */
export interface ReadResult {
  records: SessionEventRecord[];
  skipped: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseRecordLine(line: string): SessionEventRecord | null {
  const text = line.trim();
  if (!text) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.v !== 1) return null;
  if (typeof value.sessionId !== 'string' || typeof value.at !== 'string' || typeof value.day !== 'string') return null;
  if (Number.isNaN(Date.parse(value.at))) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.day)) return null;
  if (typeof value.modelId !== 'string') return null;
  if (!isRecord(value.buckets)) return null;
  for (const key of ['uncachedInput', 'output', 'cacheRead', 'cacheWrite'] as const) {
    const n = (value.buckets as Record<string, unknown>)[key];
    if (n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n < 0)) return null;
  }
  if (value.costMicros !== undefined && (typeof value.costMicros !== 'number' || !Number.isFinite(value.costMicros) || value.costMicros < 0)) return null;
  return value as unknown as SessionEventRecord;
}

export function parseJsonl(content: string): ReadResult {
  let skipped = 0;
  const records: SessionEventRecord[] = [];
  for (const line of content.split(/\r?\n/)) {
    const record = parseRecordLine(line);
    if (record) records.push(record);
    else if (line.trim()) skipped++;
  }
  return { records, skipped };
}
