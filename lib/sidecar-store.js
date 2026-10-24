import { mkdirSync, appendFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseJsonl } from './pure/sidecar.js';
export class SidecarStore {
    dataDir;
    cache = new Map();
    constructor(dataDir) {
        this.dataDir = dataDir ? expandHome(dataDir) : join(homedir(), '.dsh', 'session-insights');
    }
    fileFor(isoAt) {
        const month = isoAt.slice(0, 7);
        return join(this.dataDir, `insights-${month}.jsonl`);
    }
    append(record) {
        mkdirSync(this.dataDir, { recursive: true });
        appendFileSync(this.fileFor(record.at), `${JSON.stringify(record)}\n`, 'utf8');
    }
    readAll() {
        const records = [];
        let skipped = 0;
        if (!existsSync(this.dataDir))
            return { records, skipped };
        for (const name of readdirSync(this.dataDir).filter(validName).sort()) {
            const file = join(this.dataDir, name);
            const cached = this.readFileCached(file);
            records.push(...cached.records);
            skipped += cached.skipped;
        }
        return { records, skipped };
    }
    readFileCached(file) {
        try {
            const stat = statSync(file);
            const prior = this.cache.get(file);
            if (prior && prior.mtimeMs === stat.mtimeMs && prior.size === stat.size)
                return prior;
            const parsed = parseJsonl(readFileSync(file, 'utf8'));
            const entry = { mtimeMs: stat.mtimeMs, size: stat.size, records: parsed.records, skipped: parsed.skipped };
            this.cache.set(file, entry);
            return entry;
        }
        catch {
            // vanished mid-read or unreadable: parse deaf (readFileSync throws through)
            const parsed = parseJsonl(existsSync(file) ? readFileSync(file, 'utf8') : '');
            return { mtimeMs: -1, size: -1, records: parsed.records, skipped: parsed.skipped };
        }
    }
}
function validName(name) {
    const match = /^insights-(\d{4})-(\d{2})\.jsonl$/.exec(name);
    if (!match)
        return false;
    const month = Number(match[2]);
    return month >= 1 && month <= 12;
}
export function expandHome(dir) {
    return dir.startsWith('~') ? join(homedir(), dir.slice(1)) : dir;
}
//# sourceMappingURL=sidecar-store.js.map