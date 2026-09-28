import type { SessionEventRecord } from './stats.ts';
const HEADER = [
  'day',
  'session_id',
  'timestamp',
  'model',
  'provider',
  'uncached_input',
  'cache_read',
  'cache_write',
  'output',
  'tokens',
  'cost_micros',
  'currency',
  'turns',
] as const;

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(records: SessionEventRecord[]): string {
  const rows = [HEADER.join(',')];
  for (const record of records) {
    rows.push(
      [
        record.day,
        record.sessionId,
        record.at,
        record.modelId,
        record.provider ?? '',
        String(record.buckets.uncachedInput ?? 0),
        String(record.buckets.cacheRead ?? 0),
        String(record.buckets.cacheWrite ?? 0),
        String(record.buckets.output ?? 0),
        String((record.buckets.uncachedInput ?? 0) + (record.buckets.cacheRead ?? 0) + (record.buckets.cacheWrite ?? 0) + (record.buckets.output ?? 0)),
        record.costMicros === undefined ? '' : String(record.costMicros),
        record.currency ?? '',
        String(record.turn),
      ]
        .map(csvField)
        .join(','),
    );
  }
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}
