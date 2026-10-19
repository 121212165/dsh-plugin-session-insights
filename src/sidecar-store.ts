import { mkdirSync, appendFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseJsonl, type SessionEventRecord } from './pure/sidecar.ts';

/**
 * One JSONL sidecar per month in a plugin-owned directory. This is the same
 * degrade path the cost ledger took: dsh's ctx.storageDomain needs three extra
 * composition rows, and a flat file survives reinstalls and reads anywhere.
 *
 * Month files are parsed at most once per (mtime,size) key: /insights is served
 * from the cache on repeat calls even when the sidecars are hundreds of MB, and
 * every append flips both key parts so fresh data is never hidden behind the
 * cache. Callers only ever spread the returned arrays — never mutate them.
 */
interface MonthCache {
  mtimeMs: number;
  size: number;
  records: SessionEventRecord[];
  skipped: number;
}

export class SidecarStore {
  readonly dataDir: string;
  private readonly cache = new Map<string, MonthCache>();

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
      const file = join(this.dataDir, name);
      const cached = this.readFileCached(file);
      records.push(...cached.records);
      skipped += cached.skipped;
    }
    return { records, skipped };
  }

  private readFileCached(file: string): MonthCache {
    try {
      const stat = statSync(file);
      const prior = this.cache.get(file);
      if (prior && prior.mtimeMs === stat.mtimeMs && prior.size === stat.size) return prior;
      const parsed = parseJsonl(readFileSync(file, 'utf8'));
      const entry: MonthCache = { mtimeMs: stat.mtimeMs, size: stat.size, records: parsed.records, skipped: parsed.skipped };
      this.cache.set(file, entry);
      return entry;
    } catch {
      // vanished mid-read or unreadable: parse deaf (readFileSync throws through)
      const parsed = parseJsonl(existsSync(file) ? readFileSync(file, 'utf8') : '');
      return { mtimeMs: -1, size: -1, records: parsed.records, skipped: parsed.skipped };
    }
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
