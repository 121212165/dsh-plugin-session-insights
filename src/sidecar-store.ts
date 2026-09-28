import { mkdirSync, appendFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseJsonl, type SessionEventRecord } from './pure/sidecar.ts';

/**
 * One JSONL sidecar per month in a plugin-owned directory. This is the same
 * degrade path the cost ledger took: dsh's ctx.storageDomain needs three extra
 * composition rows, and a flat file survives reinstalls and reads anywhere.
 */
export class SidecarStore {
  readonly dataDir: string;

  constructor(dataDir: string | undefined) {
    this.dataDir = dataDir ? expandHome(dataDir) : join(homedir(), '.dsh', 'session-insights');
  }

  fileFor(isoAt: string): string {
    const month = isoAt.slice(0, 7);
    return join(this.dataDir, `insights-${month}.jsonl`);
  }

  append(record: SessionEventRecord): void {
    mkdirSync(this.dataDir, { recursive: true });
    appendFileSync(this.fileFor(record.at), `${JSON.stringify(record)}\n`, 'utf8');
  }

  readAll(): ReturnType<typeof parseJsonl> {
    const records: SessionEventRecord[] = [];
    let skipped = 0;
    if (!existsSync(this.dataDir)) return { records, skipped };
    for (const name of readdirSync(this.dataDir).filter(validName).sort()) {
      const result = parseJsonl(readFileSync(join(this.dataDir, name), 'utf8'));
      records.push(...result.records);
      skipped += result.skipped;
    }
    return { records, skipped };
  }
}

function validName(name: string): boolean {
  const match = /^insights-(\d{4})-(\d{2})\.jsonl$/.exec(name);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function expandHome(dir: string): string {
  return dir.startsWith('~') ? join(homedir(), dir.slice(1)) : dir;
}
