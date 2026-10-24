import type { SessionEventRecord } from './stats.ts';
export type { SessionEventRecord };
/** Sidecar record parser: same tolerate-and-count philosophy as the cost ledger —
 * a torn line from a crash is skipped and counted, never fatal, never rewritten. */
export interface ReadResult {
    records: SessionEventRecord[];
    skipped: number;
}
export declare function parseRecordLine(line: string): SessionEventRecord | null;
export declare function parseJsonl(content: string): ReadResult;
//# sourceMappingURL=sidecar.d.ts.map