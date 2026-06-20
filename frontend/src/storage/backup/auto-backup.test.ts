/**
 * Auto-backup ring tests (Phase 15D).
 *
 * Covers the rotation, trigger thresholds, manual-bypass-disabled
 * path, restore round-trip, and the storage-pressure probe.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {
    _resetAutoBackupDbForTests,
    _resetAutoBackupStateForTests,
    checkTimeTrigger,
    deleteAutoBackup,
    getAutoBackupPayload,
    estimateStoragePressure,
    isAutoBackupEnabled,
    listAutoBackups,
    maybeRunAutoBackup,
    recordCompletedSession,
    restoreFromAutoBackup,
    rotateAutoBackups,
    runAutoBackupNow,
    setAutoBackupEnabled,
} from "./auto-backup";
import {_resetDbForTests} from "../db/db";
import {dexieStorage} from "../db/dexie-storage";

beforeEach(async () => {
    localStorage.clear();
    _resetAutoBackupStateForTests();
    await _resetDbForTests();
    await _resetAutoBackupDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

afterEach(async () => {
    await _resetDbForTests();
    await _resetAutoBackupDbForTests();
    vi.restoreAllMocks();
});

async function seedUserId(): Promise<string> {
    const user = await dexieStorage.users.create({name: "Aster", language: "de"});
    return user.id;
}

// ---- Preferences -------------------------------------------------------

describe("auto-backup preferences", () => {
    it("defaults to enabled when no key is set", () => {
        expect(isAutoBackupEnabled()).toBe(true);
    });

    it("respects setAutoBackupEnabled(false)", () => {
        setAutoBackupEnabled(false);
        expect(isAutoBackupEnabled()).toBe(false);
        setAutoBackupEnabled(true);
        expect(isAutoBackupEnabled()).toBe(true);
    });
});

// ---- Triggers ----------------------------------------------------------

describe("recordCompletedSession", () => {
    it("returns null until the threshold is crossed", () => {
        for (let i = 0; i < 9; i += 1) {
            expect(recordCompletedSession()).toBeNull();
        }
        const trigger = recordCompletedSession();
        expect(trigger).not.toBeNull();
        expect(trigger!.reason).toBe("session-threshold");
        expect(trigger!.counter).toBe(10);
    });

    it("returns null when auto-backup is disabled", () => {
        setAutoBackupEnabled(false);
        for (let i = 0; i < 15; i += 1) {
            expect(recordCompletedSession()).toBeNull();
        }
    });
});

describe("checkTimeTrigger", () => {
    it("fires when no last-at is recorded (first run)", () => {
        const trigger = checkTimeTrigger();
        expect(trigger).not.toBeNull();
        expect(trigger!.reason).toBe("time-threshold");
    });

    it("fires when last-at is older than 7 days", async () => {
        const userId = await seedUserId();
        await runAutoBackupNow(userId, "1.2.0-test", {reason: "manual"});
        const future = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
        const trigger = checkTimeTrigger(future);
        expect(trigger).not.toBeNull();
        expect(trigger!.reason).toBe("time-threshold");
    });

    it("does NOT fire when last-at is recent", async () => {
        const userId = await seedUserId();
        await runAutoBackupNow(userId, "1.2.0-test", {reason: "manual"});
        const trigger = checkTimeTrigger();
        expect(trigger).toBeNull();
    });

    it("returns null when auto-backup is disabled", () => {
        setAutoBackupEnabled(false);
        expect(checkTimeTrigger()).toBeNull();
    });
});

// ---- Run + rotate ------------------------------------------------------

describe("runAutoBackupNow", () => {
    it("creates a backup row + resets the counter + writes last-at", async () => {
        const userId = await seedUserId();
        recordCompletedSession();
        recordCompletedSession();
        const row = await runAutoBackupNow(userId, "1.2.0-test", {
            reason: "manual",
        });
        expect(row.user_id).toBe(userId);
        expect(row.payload.format).toBe("adaptive-learner-backup");
        expect(row.total_records).toBeGreaterThan(0);
        expect(localStorage.getItem("adaptive-learner.auto_backup_session_counter")).toBe("0");
        expect(
            localStorage.getItem("adaptive-learner.auto_backup_last_at"),
        ).not.toBeNull();
    });

    it("refuses to run when disabled and trigger is not manual", async () => {
        const userId = await seedUserId();
        setAutoBackupEnabled(false);
        await expect(
            runAutoBackupNow(userId, "1.2.0-test", {reason: "session-threshold"}),
        ).rejects.toThrow(/disabled/);
    });

    it("manual trigger bypasses the disabled toggle", async () => {
        const userId = await seedUserId();
        setAutoBackupEnabled(false);
        const row = await runAutoBackupNow(userId, "1.2.0-test", {
            reason: "manual",
        });
        expect(row.user_id).toBe(userId);
    });
});

describe("rotateAutoBackups", () => {
    it("keeps the 3 most-recent entries per user", async () => {
        const userId = await seedUserId();
        for (let i = 0; i < 5; i += 1) {
            // Stagger created_at slightly so the sort is deterministic.
            await runAutoBackupNow(userId, `1.2.0-test-${i}`, {reason: "manual"});
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
        const list = await listAutoBackups(userId);
        expect(list.length).toBe(3);
        // Newest first.
        expect(list[0].app_version).toBe("1.2.0-test-4");
        expect(list[2].app_version).toBe("1.2.0-test-2");
    });

    it("does not affect other users' backups", async () => {
        const a = await seedUserId();
        const b = await seedUserId();
        for (let i = 0; i < 3; i += 1) {
            await runAutoBackupNow(a, `a-${i}`, {reason: "manual"});
            await runAutoBackupNow(b, `b-${i}`, {reason: "manual"});
        }
        expect((await listAutoBackups(a)).length).toBe(3);
        expect((await listAutoBackups(b)).length).toBe(3);
        await rotateAutoBackups(a);
        expect((await listAutoBackups(a)).length).toBe(3);
        expect((await listAutoBackups(b)).length).toBe(3);
    });
});

// ---- Restore + delete --------------------------------------------------

describe("auto-backup restore + delete", () => {
    it("restoreFromAutoBackup applies the snapshot via restoreDexieBackup", async () => {
        const userId = await seedUserId();
        const row = await runAutoBackupNow(userId, "test", {reason: "manual"});
        const summary = await restoreFromAutoBackup(userId, row.id);
        expect(summary.user_id).toBe(userId);
        expect(summary.errors).toEqual([]);
    });

    it("restoreFromAutoBackup throws on unknown id", async () => {
        const userId = await seedUserId();
        await expect(
            restoreFromAutoBackup(userId, "nope"),
        ).rejects.toThrow(/not found/);
    });

    it("deleteAutoBackup drops the row", async () => {
        const userId = await seedUserId();
        const row = await runAutoBackupNow(userId, "test", {reason: "manual"});
        expect((await listAutoBackups(userId)).length).toBe(1);
        await deleteAutoBackup(row.id);
        expect((await listAutoBackups(userId)).length).toBe(0);
    });

    // --- v1.12.0 / Phase 25D: payload accessor for compare UI ---------
    it("getAutoBackupPayload returns the stored payload for a known id", async () => {
        const userId = await seedUserId();
        const row = await runAutoBackupNow(userId, "test", {reason: "manual"});
        const payload = await getAutoBackupPayload(row.id);
        expect(payload).not.toBeNull();
        expect(payload!.format).toBe("adaptive-learner-backup");
        expect(payload!.user_id).toBe(userId);
    });

    it("getAutoBackupPayload returns null for an unknown id", async () => {
        const result = await getAutoBackupPayload("nope");
        expect(result).toBeNull();
    });
});

// ---- maybeRunAutoBackup ------------------------------------------------

describe("maybeRunAutoBackup", () => {
    it("returns null when trigger is null", async () => {
        const userId = await seedUserId();
        const result = await maybeRunAutoBackup(userId, "test", null);
        expect(result).toBeNull();
    });

    it("runs and returns the row when trigger is non-null", async () => {
        const userId = await seedUserId();
        const result = await maybeRunAutoBackup(userId, "test", {
            reason: "time-threshold",
            days_since: 8,
        });
        expect(result).not.toBeNull();
        expect(result!.user_id).toBe(userId);
    });

    it("swallows errors (does not throw to the caller)", async () => {
        // Run with a non-existent user; createDexieBackup may throw or
        // produce an empty backup. Either way, maybeRunAutoBackup
        // should not bubble the error.
        const result = await maybeRunAutoBackup("nonexistent", "test", {
            reason: "session-threshold",
            counter: 10,
        });
        // Either null (error swallowed) or a row with empty data; both
        // are acceptable as long as no exception escaped.
        expect(typeof result === "object").toBe(true);
    });
});

// ---- Storage pressure --------------------------------------------------

describe("estimateStoragePressure", () => {
    it("returns null when navigator.storage is unavailable", async () => {
        const saved = navigator.storage;
        // Force the API to look missing.
        Object.defineProperty(navigator, "storage", {
            configurable: true,
            value: undefined,
        });
        try {
            const result = await estimateStoragePressure();
            expect(result).toBeNull();
        } finally {
            Object.defineProperty(navigator, "storage", {
                configurable: true,
                value: saved,
            });
        }
    });

    it("flags is_pressured when usage > 90% of quota", async () => {
        const mockStorage = {
            estimate: async () => ({usage: 950, quota: 1000}),
        };
        Object.defineProperty(navigator, "storage", {
            configurable: true,
            value: mockStorage,
        });
        const result = await estimateStoragePressure();
        expect(result).not.toBeNull();
        expect(result!.is_pressured).toBe(true);
        expect(result!.usage_ratio).toBeGreaterThan(0.9);
    });

    it("does NOT flag when usage <= 90% of quota", async () => {
        const mockStorage = {
            estimate: async () => ({usage: 500, quota: 1000}),
        };
        Object.defineProperty(navigator, "storage", {
            configurable: true,
            value: mockStorage,
        });
        const result = await estimateStoragePressure();
        expect(result!.is_pressured).toBe(false);
    });
});
