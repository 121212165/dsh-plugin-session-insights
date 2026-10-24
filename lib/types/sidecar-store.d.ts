import { parseJsonl, type SessionEventRecord } from './pure/sidecar.ts';
export declare class SidecarStore {
    readonly dataDir: string;
    private readonly cache;
    constructor(dataDir: string | undefined);
    fileFor(isoAt: string): string;
    append(record: SessionEventRecord): void;
    readAll(): ReturnType<typeof parseJsonl>;
    private readFileCached;
}
export declare function expandHome(dir: string): string;
//# sourceMappingURL=sidecar-store.d.ts.map