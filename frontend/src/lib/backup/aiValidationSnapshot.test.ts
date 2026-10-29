/**
 * Cached AI content-check reports travel with the backup (#3412).
 *
 * A report carries the AIV-09 signature (content hash plus the provider's
 * response ids) behind the "AI-checked" badge. It is only made by hand in
 * the AI validation dialog, with a paid call and an API key, so losing it
 * on Export -> new device -> Import loses something the learner paid for.
 */

import {describe, expect, it} from "vitest";

import {
    captureAiValidationSnapshot,
    restoreAiValidationSnapshot,
    type AiValidationStore,
} from "./aiValidationSnapshot";
import type {AiValidationCacheRecord} from "../../storage/types";

function report(over: Partial<AiValidationCacheRecord> = {}): AiValidationCacheRecord {
    return {
        source: "astrapi69/adaptive-learner-content",
        set_id: "es-a1",
        set_version: "1.0.0",
        content_hash: "sha256:abc",
        results: [{card_id: "c1", ok: true, issues: []}],
        response_ids: ["resp-1"],
        provider: "openai",
        model: "gpt-4o-mini",
        card_count: 1,
        issue_count: 0,
        checked_at: "2026-10-01T10:00:00.000Z",
        signature: null,
        ...over,
    };
}

function key(r: Pick<AiValidationCacheRecord, "source" | "set_id">): string {
    return `${r.source}#${r.set_id}`;
}

function memoryStore(initial: AiValidationCacheRecord[] = []): AiValidationStore & {
    rows: Map<string, AiValidationCacheRecord>;
    saved: string[];
} {
    const rows = new Map(initial.map((r) => [key(r), structuredClone(r)]));
    const saved: string[] = [];
    return {
        rows,
        saved,
        list: async () => [...rows.values()].map((r) => structuredClone(r)),
        get: async (source, setId) => structuredClone(rows.get(`${source}#${setId}`) ?? null),
        save: async (record) => {
            saved.push(key(record));
            rows.set(key(record), structuredClone(record));
        },
    };
}

describe("captureAiValidationSnapshot (#3412)", () => {
    it("captures every cached report", async () => {
        const store = memoryStore([report(), report({set_id: "fr-a1"})]);
        const snapshot = await captureAiValidationSnapshot(store);
        expect(snapshot.map(key).sort()).toEqual([
            "astrapi69/adaptive-learner-content#es-a1",
            "astrapi69/adaptive-learner-content#fr-a1",
        ]);
    });

    it("leaves the block empty instead of failing the export when the cache cannot be read", async () => {
        const store = {...memoryStore(), list: () => Promise.reject(new Error("IndexedDB gone"))};
        expect(await captureAiValidationSnapshot(store)).toEqual([]);
    });

    it("is an empty block when the store has none (API mode)", async () => {
        expect(await captureAiValidationSnapshot(memoryStore())).toEqual([]);
    });
});

describe("restoreAiValidationSnapshot (#3412)", () => {
    it("adds a report this device lacks", async () => {
        const store = memoryStore();
        const applied = await restoreAiValidationSnapshot([report()], store);
        expect(applied).toBe(1);
        expect(store.rows.get(key(report()))).toEqual(report());
    });

    it.each([
        ["the backup's newer report replaces the local one", "2026-10-01T10:00:00.000Z", "2026-10-05T10:00:00.000Z", "backup"],
        ["the local newer report stays", "2026-10-05T10:00:00.000Z", "2026-10-01T10:00:00.000Z", "local"],
        ["an equally old report keeps the local one", "2026-10-01T10:00:00.000Z", "2026-10-01T10:00:00.000Z", "local"],
    ])("per key the newer checked_at wins: %s", async (_label, localAt, backupAt, winner) => {
        const local = report({checked_at: localAt, model: "local"});
        const incoming = report({checked_at: backupAt, model: "backup"});
        const store = memoryStore([local]);
        await restoreAiValidationSnapshot([incoming], store);
        expect(store.rows.get(key(local))?.model).toBe(winner);
    });

    it.each([
        ["an absent block (pre-1.9.0 backup)", undefined],
        ["a block that is not a list", {"es-a1": report()}],
    ])("is a no-op for %s", async (_label, block) => {
        const store = memoryStore([report()]);
        expect(await restoreAiValidationSnapshot(block as unknown as AiValidationCacheRecord[], store)).toBe(0);
        expect(store.saved).toEqual([]);
    });

    it("skips an entry without source, set_id or checked_at", async () => {
        const store = memoryStore();
        const broken = [{set_id: "x"}, {...report(), checked_at: undefined}] as unknown as AiValidationCacheRecord[];
        expect(await restoreAiValidationSnapshot([...broken, report()], store)).toBe(1);
        expect(store.saved).toEqual([key(report())]);
    });
});

describe("restoreAiValidationSnapshot in API mode (#3412)", () => {
    it("writes nothing where no report cache exists", async () => {
        const store = {...memoryStore(), isEnabled: () => false};
        expect(await restoreAiValidationSnapshot([report()], store)).toBe(0);
        expect(store.saved).toEqual([]);
    });
});
