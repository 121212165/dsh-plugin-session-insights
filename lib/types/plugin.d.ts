/**
 * dsh wiring for the session-insights plugin.
 *
 * Accounting rides the same event surface price-aware verified (session/event
 * assistant/message usage, with the model pair read from the message source),
 * but the sidecar is
 * token-first: unpriced models still count, cost rides along when known.
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { type PriceEntry } from './pricing/catalog.ts';
export declare const name = "session-insights";
export declare const inject: string[];
export interface Config {
    enabled: boolean;
    dataDir?: string;
    exportDir?: string;
    topSessions: number;
    recentDays: number;
    prices: PriceEntry[];
}
export declare const Config: Schema<Schemastery.ObjectS<{
    enabled: Schema<boolean, boolean>;
    dataDir: Schema<string, string>;
    exportDir: Schema<string, string>;
    topSessions: Schema<number, number>;
    recentDays: Schema<number, number>;
    prices: Schema<({
        id?: string | null | undefined;
        currency?: "CNY" | "EUR" | "USD" | null | undefined;
        perMillion?: ({
            cacheRead?: number | null | undefined;
            uncachedInput?: number | null | undefined;
            output?: number | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict) | null | undefined;
        peakMultiplier?: number | null | undefined;
        contextTokens?: number | null | undefined;
        maxOutputTokens?: number | null | undefined;
        aliases?: string[] | null | undefined;
        note?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: Schema<string, string>;
        currency: Schema<"CNY" | "EUR" | "USD", "CNY" | "EUR" | "USD">;
        perMillion: Schema<Schemastery.ObjectS<{
            cacheRead: Schema<number, number>;
            uncachedInput: Schema<number, number>;
            output: Schema<number, number>;
        }>, Schemastery.ObjectT<{
            cacheRead: Schema<number, number>;
            uncachedInput: Schema<number, number>;
            output: Schema<number, number>;
        }>>;
        peakMultiplier: Schema<number, number>;
        contextTokens: Schema<number, number>;
        maxOutputTokens: Schema<number, number>;
        aliases: Schema<string[], string[]>;
        note: Schema<string, string>;
    }>[]>;
}>, Schemastery.ObjectT<{
    enabled: Schema<boolean, boolean>;
    dataDir: Schema<string, string>;
    exportDir: Schema<string, string>;
    topSessions: Schema<number, number>;
    recentDays: Schema<number, number>;
    prices: Schema<({
        id?: string | null | undefined;
        currency?: "CNY" | "EUR" | "USD" | null | undefined;
        perMillion?: ({
            cacheRead?: number | null | undefined;
            uncachedInput?: number | null | undefined;
            output?: number | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict) | null | undefined;
        peakMultiplier?: number | null | undefined;
        contextTokens?: number | null | undefined;
        maxOutputTokens?: number | null | undefined;
        aliases?: string[] | null | undefined;
        note?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: Schema<string, string>;
        currency: Schema<"CNY" | "EUR" | "USD", "CNY" | "EUR" | "USD">;
        perMillion: Schema<Schemastery.ObjectS<{
            cacheRead: Schema<number, number>;
            uncachedInput: Schema<number, number>;
            output: Schema<number, number>;
        }>, Schemastery.ObjectT<{
            cacheRead: Schema<number, number>;
            uncachedInput: Schema<number, number>;
            output: Schema<number, number>;
        }>>;
        peakMultiplier: Schema<number, number>;
        contextTokens: Schema<number, number>;
        maxOutputTokens: Schema<number, number>;
        aliases: Schema<string[], string[]>;
        note: Schema<string, string>;
    }>[]>;
}>>;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=plugin.d.ts.map