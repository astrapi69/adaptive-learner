/**
 * #791 Teil B — device-local user-data Dexie canonical store + localStorage
 * cache reconciliation. Exercises the write-through mirror, the boot reconcile
 * (Dexie wins / localStorage seeds Dexie), the API-mode no-op, and the
 * end-to-end integration with the synchronous lib writers
 * (``contribution-history`` + ``custom-paths``).
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb} from "./db";
import {
    MANAGED_USER_DATA_KEYS,
    mirrorUserData,
    syncLanguageAtBoot,
    syncUserDataAtBoot,
} from "./dexie-user-data";
import {listContributions, recordContribution} from "../../lib/content/placement/contribution-history";
import {createCustomPath, listCustomPaths} from "../../lib/learning-path/custom-paths";

const CONTRIB_KEY = "adaptive-learner.contributions";
const MODE_KEY = "adaptive-learner.storage_mode";

async function freshDb() {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
}

beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem(MODE_KEY, "dexie");
    await freshDb();
});

afterEach(async () => {
    localStorage.clear();
    await _resetDbForTests();
});

describe("mirrorUserData (#791)", () => {
    it("writes a value into the Dexie userData store in Dexie mode", async () => {
        await mirrorUserData(CONTRIB_KEY, '[{"x":1}]');
        const row = await getDb().userData.get(CONTRIB_KEY);
        expect(row?.value).toBe('[{"x":1}]');
    });

    it("deletes the row when value is null", async () => {
        await mirrorUserData(CONTRIB_KEY, "seed");
        await mirrorUserData(CONTRIB_KEY, null);
        expect(await getDb().userData.get(CONTRIB_KEY)).toBeUndefined();
    });

    it("is a no-op in API mode", async () => {
        await getDb().userData.clear();
        localStorage.setItem(MODE_KEY, "api");
        await mirrorUserData(CONTRIB_KEY, "ignored");
        expect(await getDb().userData.get(CONTRIB_KEY)).toBeUndefined();
    });
});

describe("syncUserDataAtBoot (#791)", () => {
    it("seeds Dexie from localStorage when Dexie is empty", async () => {
        localStorage.setItem(CONTRIB_KEY, '["from-local"]');
        await syncUserDataAtBoot([CONTRIB_KEY]);
        expect((await getDb().userData.get(CONTRIB_KEY))?.value).toBe('["from-local"]');
    });

    it("lets Dexie win and hydrates the localStorage cache (restore case)", async () => {
        localStorage.setItem(CONTRIB_KEY, '["stale-local"]');
        await getDb().userData.put({key: CONTRIB_KEY, value: '["canonical-dexie"]'});
        await syncUserDataAtBoot([CONTRIB_KEY]);
        expect(localStorage.getItem(CONTRIB_KEY)).toBe('["canonical-dexie"]');
    });

    it("does nothing in API mode", async () => {
        await getDb().userData.clear();
        localStorage.setItem(MODE_KEY, "api");
        localStorage.setItem(CONTRIB_KEY, '["x"]');
        await syncUserDataAtBoot([CONTRIB_KEY]);
        expect(await getDb().userData.get(CONTRIB_KEY)).toBeUndefined();
    });

    it("covers the contributions, contributor-name, custom-paths, dismissed-sets, set-status and lesson-order keys", () => {
        expect(MANAGED_USER_DATA_KEYS).toEqual([
            "adaptive-learner.contributions",
            "adaptive-learner.contributor-name",
            "adaptive-learner.custom-paths",
            "adaptive-learner.dismissed-sets",
            "adaptive-learner.set-status",
            "adaptive-learner.lesson-order",
        ]);
    });
});

describe("syncLanguageAtBoot (#791)", () => {
    const USER_KEY = "adaptive-learner.user_id";
    const LANG_KEY = "adaptive-learner.language";

    it("hydrates the localStorage language cache from Dexie user_settings", async () => {
        localStorage.setItem(USER_KEY, "u1");
        localStorage.setItem(LANG_KEY, "en");
        await getDb().userSettings.put({
            id: "s1",
            user_id: "u1",
            language: "ko",
        } as never);
        await syncLanguageAtBoot();
        expect(localStorage.getItem(LANG_KEY)).toBe("ko");
    });

    it("no-ops when no user is resolved", async () => {
        localStorage.setItem(LANG_KEY, "en");
        await syncLanguageAtBoot();
        expect(localStorage.getItem(LANG_KEY)).toBe("en");
    });
});

describe("lib writers mirror through to Dexie (#791)", () => {
    it("recordContribution lands in the Dexie canonical store", async () => {
        recordContribution({
            lesson_id: "l1",
            title: "Greetings",
            shared_at: "2026-06-20T10:00:00Z",
            github_url: "https://github.com/x/y/pull/1",
            status: "submitted",
        });
        // Mirror is fire-and-forget; let the microtask settle.
        await Promise.resolve();
        const row = await getDb().userData.get(CONTRIB_KEY);
        expect(row).toBeDefined();
        expect(JSON.parse(row!.value)).toHaveLength(1);
        // localStorage read path is unchanged.
        expect(listContributions()).toHaveLength(1);
    });

    it("createCustomPath mirrors the custom-paths blob", async () => {
        createCustomPath("My path");
        await Promise.resolve();
        const row = await getDb().userData.get("adaptive-learner.custom-paths");
        expect(row).toBeDefined();
        expect(JSON.parse(row!.value)).toHaveLength(1);
        expect(listCustomPaths()).toHaveLength(1);
    });
});
