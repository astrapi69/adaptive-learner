/**
 * Regression: the Dexie schema-v21 (v1.40.0) upgrade must complete in
 * place. The original upgrade did ``await import("./badges")`` INSIDE
 * the IndexedDB upgrade transaction; a native dynamic import escapes
 * Dexie's promise-zone tracking, so the transaction auto-committed
 * during the await and the next ``tx.table(...)`` threw "The
 * transaction has finished" (surfaced to users as DatabaseClosedError
 * on every op, e.g. loading imported conversations on /import).
 *
 * This test builds a v20 database, then opens AdaptiveLearnerDB (v21)
 * against it and asserts the badge-tier backfill ran without aborting.
 */

import "fake-indexeddb/auto";
import Dexie from "dexie";
import {IDBFactory} from "fake-indexeddb";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {AdaptiveLearnerDB, _resetDbForTests} from "./db";
import {BUNDLED_BADGES} from "./badges-data";

const NAME = "adaptive-learner";

beforeEach(() => {
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
});

afterEach(async () => {
    await _resetDbForTests();
});

describe("Dexie v21 upgrade (badge tiers)", () => {
    it("upgrades a v20 database in place without finishing the transaction early", async () => {
        // Seed a pre-tier v20 database.
        const legacy = new Dexie(NAME);
        legacy.version(20).stores({
            badges: "id, key",
            userBadges: "id, user_id, badge_id",
        });
        await legacy.open();
        const spec = BUNDLED_BADGES[0];
        await legacy.table("badges").put({
            id: "b1",
            key: spec.key,
            name_key: spec.name_key,
        });
        await legacy.table("userBadges").put({
            id: "ub1",
            user_id: "u1",
            badge_id: "b1",
            earned_at: "2026-01-01T00:00:00Z",
        });
        legacy.close();

        // Open at v21 -> runs the upgrade. Must NOT throw.
        const db = new AdaptiveLearnerDB(NAME);
        await db.open();
        expect(db.verno).toBe(21);

        const badge = (await db.table("badges").get("b1")) as Record<string, unknown>;
        expect(badge.base_tier).toBeTruthy();

        const ub = (await db.table("userBadges").get("ub1")) as Record<string, unknown>;
        expect(ub.tier).toBeTruthy();
        expect(ub.updated_at).toBe("2026-01-01T00:00:00Z");
        db.close();
    });

    it("does not use a dynamic import inside the v21 upgrade (the bug pattern)", () => {
        const here = dirname(fileURLToPath(import.meta.url));
        const dbSrc = readFileSync(resolve(here, "db.ts"), "utf-8");
        const upgradeIdx = dbSrc.indexOf("this.version(21)");
        expect(upgradeIdx).toBeGreaterThan(-1);
        const upgradeBlock = dbSrc.slice(upgradeIdx, upgradeIdx + 1500);
        expect(upgradeBlock).not.toMatch(/await\s+import\s*\(/);
    });

    it("badges-data.ts has no db.ts dependency (keeps the cycle broken)", () => {
        const here = dirname(fileURLToPath(import.meta.url));
        const dataSrc = readFileSync(resolve(here, "badges-data.ts"), "utf-8");
        expect(dataSrc).not.toMatch(/from\s+["']\.\/db["']/);
    });
});
