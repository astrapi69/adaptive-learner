/**
 * Tests for the Dexie-mode element-errors store
 * (Phase 46B / C7 / P-129).
 *
 * Reuses the backend transition matrix as a contract: every
 * case here mirrors a pytest case in
 * ``test_element_errors_service.py`` so a future divergence
 * in either backend surfaces as a Vitest failure too.
 *
 * Per the v1.28.0 "Dexie test isolation" lesson-learned:
 * explicitly ``.clear()`` the table in beforeEach BEFORE
 * resetting the connection — relying on globalThis.indexedDB
 * alone isn't enough because Dexie can cache the old factory.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb} from "./db";
import {
    MASTERY_THRESHOLD,
    listElementErrorsDexie,
    recordElementAttemptsDexie,
} from "./element-errors-dexie";
import type {ElementAttempt} from "./types";

const USER = "user-1";

function attempt(overrides: Partial<ElementAttempt> = {}): ElementAttempt {
    return {
        set_id: "language-fr-a1",
        lesson_id: "01-greetings.json",
        exercise_id: "ex-thanks",
        element_key: "merci",
        element_type: "vocabulary",
        user_answer: "",
        correct_answer: "Merci",
        correct: false,
        ...overrides,
    };
}

beforeEach(async () => {
    const db = getDb();
    try {
        await db.elementErrors.clear();
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

describe("Dexie elementErrors: MASTERY_THRESHOLD contract", () => {
    it("exports the same threshold the backend uses (3)", () => {
        expect(MASTERY_THRESHOLD).toBe(3);
    });
});

describe("Dexie elementErrors: no-row branches", () => {
    it("first correct creates a row with streak=1, error_count=0", async () => {
        const rows = await recordElementAttemptsDexie(USER, [
            attempt({correct: true, user_answer: "merci"}),
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].error_count).toBe(0);
        expect(rows[0].correct_streak).toBe(1);
        expect(rows[0].mastered).toBe(false);
        expect(rows[0].last_error_at).toBeNull();
        expect(rows[0].user_answer).toBe("merci");
    });

    it("first wrong creates a row with error_count=1, last_error_at set", async () => {
        const rows = await recordElementAttemptsDexie(USER, [
            attempt({correct: false, user_answer: "bonjour"}),
        ]);
        expect(rows[0].error_count).toBe(1);
        expect(rows[0].correct_streak).toBe(0);
        expect(rows[0].last_error_at).not.toBeNull();
        expect(rows[0].user_answer).toBe("bonjour");
    });
});

describe("Dexie elementErrors: transition matrix", () => {
    it("wrong → wrong increments error_count, streak stays 0", async () => {
        await recordElementAttemptsDexie(USER, [attempt({correct: false})]);
        const rows = await recordElementAttemptsDexie(USER, [
            attempt({correct: false}),
        ]);
        expect(rows[0].error_count).toBe(2);
        expect(rows[0].correct_streak).toBe(0);
    });

    it("wrong → correct starts streak at 1 (error_count NOT decremented)", async () => {
        await recordElementAttemptsDexie(USER, [attempt({correct: false})]);
        const rows = await recordElementAttemptsDexie(USER, [
            attempt({correct: true}),
        ]);
        expect(rows[0].error_count).toBe(1);
        expect(rows[0].correct_streak).toBe(1);
        expect(rows[0].mastered).toBe(false);
    });

    it("3 consecutive corrects flip mastered + set mastered_at", async () => {
        for (let i = 0; i < MASTERY_THRESHOLD; i++) {
            await recordElementAttemptsDexie(USER, [attempt({correct: true})]);
        }
        const list = await listElementErrorsDexie(USER);
        expect(list[0].mastered).toBe(true);
        expect(list[0].mastered_at).not.toBeNull();
        expect(list[0].correct_streak).toBe(MASTERY_THRESHOLD);
    });

    it("mastered → wrong demotes (pedagogical reset)", async () => {
        for (let i = 0; i < MASTERY_THRESHOLD; i++) {
            await recordElementAttemptsDexie(USER, [attempt({correct: true})]);
        }
        const rows = await recordElementAttemptsDexie(USER, [
            attempt({correct: false}),
        ]);
        expect(rows[0].mastered).toBe(false);
        expect(rows[0].mastered_at).toBeNull();
        expect(rows[0].correct_streak).toBe(0);
        expect(rows[0].error_count).toBe(1);
        expect(rows[0].last_error_at).not.toBeNull();
    });

    it("mastered → correct keeps mastered_at stable", async () => {
        for (let i = 0; i < MASTERY_THRESHOLD; i++) {
            await recordElementAttemptsDexie(USER, [attempt({correct: true})]);
        }
        const before = await listElementErrorsDexie(USER);
        const firstMasteredAt = before[0].mastered_at;
        // Two more corrects.
        await recordElementAttemptsDexie(USER, [attempt({correct: true})]);
        await recordElementAttemptsDexie(USER, [attempt({correct: true})]);
        const after = await listElementErrorsDexie(USER);
        expect(after[0].mastered).toBe(true);
        expect(after[0].mastered_at).toBe(firstMasteredAt);
        expect(after[0].correct_streak).toBe(MASTERY_THRESHOLD + 2);
    });
});

describe("Dexie elementErrors: composite-key isolation", () => {
    it("different element keys → separate rows", async () => {
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "merci", correct: false}),
            attempt({element_key: "bonjour", correct: false}),
        ]);
        const rows = await listElementErrorsDexie(USER);
        const keys = new Set(rows.map((r) => r.element_key));
        expect(keys).toEqual(new Set(["merci", "bonjour"]));
    });

    it("same element + different lessons → separate rows (D2 lesson-scoping)", async () => {
        await recordElementAttemptsDexie(USER, [
            attempt({lesson_id: "01-greetings.json", correct: false}),
            attempt({lesson_id: "02-numbers.json", correct: false}),
        ]);
        const rows = await listElementErrorsDexie(USER);
        const lessonIds = new Set(rows.map((r) => r.lesson_id));
        expect(lessonIds).toEqual(
            new Set(["01-greetings.json", "02-numbers.json"]),
        );
        expect(rows.every((r) => r.error_count === 1)).toBe(true);
    });

    it("different users isolated", async () => {
        await recordElementAttemptsDexie("user-a", [attempt({correct: false})]);
        await recordElementAttemptsDexie("user-b", [attempt({correct: false})]);
        const a = await listElementErrorsDexie("user-a");
        const b = await listElementErrorsDexie("user-b");
        expect(a).toHaveLength(1);
        expect(b).toHaveLength(1);
    });
});

describe("Dexie elementErrors: bulk + edge cases", () => {
    it("preserves input order in the response", async () => {
        const keys = ["alpha", "beta", "gamma"];
        const rows = await recordElementAttemptsDexie(
            USER,
            keys.map((k) => attempt({element_key: k, correct: false})),
        );
        expect(rows.map((r) => r.element_key)).toEqual(keys);
    });

    it("empty bulk returns [] without DB touch", async () => {
        const rows = await recordElementAttemptsDexie(USER, []);
        expect(rows).toEqual([]);
        const list = await listElementErrorsDexie(USER);
        expect(list).toEqual([]);
    });

    it("intra-bulk state compounding: 3 corrects same key in one call flips mastered", async () => {
        const rows = await recordElementAttemptsDexie(
            USER,
            Array(MASTERY_THRESHOLD)
                .fill(0)
                .map(() => attempt({correct: true})),
        );
        expect(rows[0].id).toBe(rows[rows.length - 1].id);
        expect(rows[rows.length - 1].mastered).toBe(true);
    });
});

describe("Dexie elementErrors: list filters", () => {
    it("filters by set_id", async () => {
        await recordElementAttemptsDexie(USER, [
            attempt({set_id: "set-a", correct: false}),
            attempt({set_id: "set-b", correct: false}),
        ]);
        const aOnly = await listElementErrorsDexie(USER, {setId: "set-a"});
        expect(aOnly).toHaveLength(1);
        expect(aOnly[0].set_id).toBe("set-a");
    });

    it("excludes mastered when includeMastered=false", async () => {
        for (let i = 0; i < MASTERY_THRESHOLD; i++) {
            await recordElementAttemptsDexie(USER, [attempt({correct: true})]);
        }
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "bonjour", correct: false}),
        ]);
        const all = await listElementErrorsDexie(USER, {includeMastered: true});
        const active = await listElementErrorsDexie(USER, {
            includeMastered: false,
        });
        expect(all).toHaveLength(2);
        expect(active).toHaveLength(1);
        expect(active[0].element_key).toBe("bonjour");
    });
});
