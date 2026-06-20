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

import {_resetDbForTests, getDb} from "../db/db";
import {
    HINT_INTERVAL_FACTOR,
    MASTERY_THRESHOLD,
    computeReviewQueueDexie,
    intervalDaysForStreak,
    listElementErrorsDexie,
    recordElementAttemptsDexie,
} from "./element-errors-dexie";
import type {ElementAttempt} from "../types";

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

describe("Dexie elementErrors: #594 hint economy", () => {
    it("tracks hint_used + accumulates hint_used_count", async () => {
        await recordElementAttemptsDexie(USER, [
            attempt({correct: false, hint_used: false}),
        ]);
        let rows = await listElementErrorsDexie(USER);
        expect(rows[0].hint_used).toBe(false);
        expect(rows[0].hint_used_count).toBe(0);

        await recordElementAttemptsDexie(USER, [
            attempt({correct: false, hint_used: true}),
        ]);
        rows = await listElementErrorsDexie(USER);
        expect(rows[0].hint_used).toBe(true);
        expect(rows[0].hint_used_count).toBe(1);

        // A hint-free attempt clears the flag but holds the count.
        await recordElementAttemptsDexie(USER, [
            attempt({correct: true, hint_used: false}),
        ]);
        rows = await listElementErrorsDexie(USER);
        expect(rows[0].hint_used).toBe(false);
        expect(rows[0].hint_used_count).toBe(1);
    });

    it("halves the review interval for a hint-assisted answer", async () => {
        expect(HINT_INTERVAL_FACTOR).toBe(0.5);
        await recordElementAttemptsDexie(USER, [
            attempt({correct: false, hint_used: true}),
        ]);
        const queue = await computeReviewQueueDexie(USER);
        expect(queue).toHaveLength(1);
        const last = new Date(queue[0].last_attempt_at).getTime();
        const suggested = new Date(queue[0].suggested_review_at).getTime();
        // streak 0 → 1d band, halved → 0.5d = 12h.
        expect(suggested - last).toBeCloseTo(0.5 * 86_400_000, -3);
    });
});

describe("Dexie elementErrors: #603 smart review queue", () => {
    it("tracks attempt_count + a 10-entry history ring buffer", async () => {
        for (let n = 0; n < 12; n++) {
            await recordElementAttemptsDexie(USER, [
                attempt({correct: n % 2 === 0}),
            ]);
        }
        const rows = await listElementErrorsDexie(USER);
        expect(rows[0].attempt_count).toBe(12);
        expect(rows[0].attempt_history).toHaveLength(10);
        // Last recorded attempt was n=11 → odd → wrong.
        expect(rows[0].attempt_history?.at(-1)?.correct).toBe(false);
    });

    it("orders wrong before almost-right (weakness tier)", async () => {
        // 'almost' recovered after 2 errors (streak 1, errors 2).
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "almost", correct: false}),
        ]);
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "almost", correct: false}),
        ]);
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "almost", correct: true}),
        ]);
        // 'wrong' — a single wrong (streak 0, errors 1).
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "wrong", correct: false}),
        ]);
        // Force both overdue.
        const past = new Date(Date.now() - 10 * 86_400_000).toISOString();
        const db = getDb();
        await db.elementErrors.toCollection().modify((r) => {
            r.last_attempt_at = past;
        });
        const queue = await computeReviewQueueDexie(USER);
        expect(queue[0].element_key).toBe("wrong");
        expect(queue[1].element_key).toBe("almost");
    });

    it("caps the queue at the requested limit", async () => {
        for (let i = 0; i < 5; i++) {
            await recordElementAttemptsDexie(USER, [
                attempt({element_key: `el-${i}`, correct: false}),
            ]);
        }
        expect(await computeReviewQueueDexie(USER)).toHaveLength(5);
        expect(
            await computeReviewQueueDexie(USER, {limit: 3}),
        ).toHaveLength(3);
        expect(
            await computeReviewQueueDexie(USER, {limit: 0}),
        ).toHaveLength(0);
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

// --- Phase 46C / C12: review-queue computation -----------------------------

describe("Dexie elementErrors: intervalDaysForStreak", () => {
    it("streak 0 → 1 day", () => {
        expect(intervalDaysForStreak(0)).toBe(1);
    });
    it("streak 1 → 3 days", () => {
        expect(intervalDaysForStreak(1)).toBe(3);
    });
    it("streak 2 → 7 days", () => {
        expect(intervalDaysForStreak(2)).toBe(7);
    });
    it("streak 3+ caps at 7 days (mastered handled upstream)", () => {
        expect(intervalDaysForStreak(3)).toBe(7);
        expect(intervalDaysForStreak(10)).toBe(7);
    });
    it("negative streak defensively returns 1", () => {
        expect(intervalDaysForStreak(-1)).toBe(1);
    });
});

describe("Dexie elementErrors: computeReviewQueueDexie", () => {
    it("empty user returns empty queue", async () => {
        const queue = await computeReviewQueueDexie(USER);
        expect(queue).toEqual([]);
    });

    it("excludes mastered elements", async () => {
        for (let i = 0; i < MASTERY_THRESHOLD; i++) {
            await recordElementAttemptsDexie(USER, [attempt({correct: true})]);
        }
        const queue = await computeReviewQueueDexie(USER);
        expect(queue).toEqual([]);
    });

    it("projects active elements with scheduling fields", async () => {
        await recordElementAttemptsDexie(USER, [attempt({correct: false})]);
        const queue = await computeReviewQueueDexie(USER);
        expect(queue).toHaveLength(1);
        expect(queue[0].element_key).toBe("merci");
        expect(queue[0].suggested_review_at).toBeDefined();
        expect(typeof queue[0].overdue).toBe("boolean");
    });

    it("suggested_review_at = last_attempt_at + interval(streak)", async () => {
        const rows = await recordElementAttemptsDexie(USER, [
            attempt({correct: false}),
        ]);
        const last = new Date(rows[0].last_attempt_at);
        const queue = await computeReviewQueueDexie(USER);
        const suggested = new Date(queue[0].suggested_review_at);
        const deltaMs = suggested.getTime() - last.getTime();
        // 1 day = 86400000ms; allow ±1s for arithmetic.
        expect(Math.abs(deltaMs - 86400000)).toBeLessThan(1000);
    });

    it("overdue flag respects injected clock", async () => {
        await recordElementAttemptsDexie(USER, [attempt({correct: false})]);
        const futureIso = new Date(
            Date.now() + 2 * 86400000,
        ).toISOString();
        const queue = await computeReviewQueueDexie(USER, {
            nowIso: futureIso,
        });
        expect(queue[0].overdue).toBe(true);

        const presentIso = new Date().toISOString();
        const queueNow = await computeReviewQueueDexie(USER, {
            nowIso: presentIso,
        });
        expect(queueNow[0].overdue).toBe(false);
    });

    it("sorts overdue items first", async () => {
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "overdue-one", correct: false}),
        ]);
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "fresh-one", correct: false}),
        ]);
        // Force "overdue-one" into the overdue bucket by
        // backdating its last_attempt_at directly in the DB.
        const db = getDb();
        const all = await db.elementErrors.toArray();
        const overdueRow = all.find((r) => r.element_key === "overdue-one");
        if (overdueRow) {
            overdueRow.last_attempt_at = new Date(
                Date.now() - 10 * 86400000,
            ).toISOString();
            await db.elementErrors.put(overdueRow);
        }
        const queue = await computeReviewQueueDexie(USER);
        expect(queue[0].element_key).toBe("overdue-one");
        expect(queue[0].overdue).toBe(true);
        expect(queue[1].element_key).toBe("fresh-one");
    });

    it("sorts higher error_count first within the overdue bucket", async () => {
        for (let i = 0; i < 3; i++) {
            await recordElementAttemptsDexie(USER, [
                attempt({element_key: "high", correct: false}),
            ]);
        }
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "low", correct: false}),
        ]);
        // Push both into the overdue bucket.
        const db = getDb();
        const all = await db.elementErrors.toArray();
        const past = new Date(Date.now() - 10 * 86400000).toISOString();
        for (const row of all) {
            row.last_attempt_at = past;
            await db.elementErrors.put(row);
        }
        const queue = await computeReviewQueueDexie(USER);
        expect(queue[0].element_key).toBe("high");
        expect(queue[0].error_count).toBe(3);
        expect(queue[1].element_key).toBe("low");
        expect(queue[1].error_count).toBe(1);
    });

    it("filters by set_id", async () => {
        await recordElementAttemptsDexie(USER, [
            attempt({set_id: "set-a", correct: false}),
            attempt({set_id: "set-b", correct: false}),
        ]);
        const aQueue = await computeReviewQueueDexie(USER, {
            setId: "set-a",
        });
        expect(aQueue).toHaveLength(1);
        expect(aQueue[0].set_id).toBe("set-a");
    });
});

describe("Dexie elementErrors: EXP-018 direction-awareness", () => {
    it("records two independent rows for the two directions", async () => {
        await recordElementAttemptsDexie(USER, [
            attempt({direction: "target_to_source", correct: true}),
            attempt({direction: "source_to_target", correct: false}),
        ]);
        const rows = await listElementErrorsDexie(USER);
        expect(rows).toHaveLength(2);
        const byDir = Object.fromEntries(rows.map((r) => [r.direction, r]));
        expect(byDir.target_to_source.correct_streak).toBe(1);
        expect(byDir.target_to_source.error_count).toBe(0);
        expect(byDir.source_to_target.error_count).toBe(1);
    });

    it("masters each direction independently", async () => {
        for (let i = 0; i < MASTERY_THRESHOLD; i++) {
            await recordElementAttemptsDexie(USER, [
                attempt({direction: "target_to_source", correct: true}),
            ]);
        }
        await recordElementAttemptsDexie(USER, [
            attempt({direction: "source_to_target", correct: true}),
        ]);
        const rows = await listElementErrorsDexie(USER);
        const byDir = Object.fromEntries(rows.map((r) => [r.direction, r]));
        expect(byDir.target_to_source.mastered).toBe(true);
        expect(byDir.source_to_target.mastered).toBe(false);
    });

    it("defaults to receptive when direction omitted", async () => {
        const [row] = await recordElementAttemptsDexie(USER, [
            attempt({correct: true}),
        ]);
        expect(row.direction).toBe("target_to_source");
    });

    it("the composite id includes the direction segment", async () => {
        const [row] = await recordElementAttemptsDexie(USER, [
            attempt({direction: "source_to_target", correct: true}),
        ]);
        expect(row.id.endsWith("#source_to_target")).toBe(true);
    });
});

describe("Dexie review queue: EXP-018 productive weighting", () => {
    it("ranks a productive error above a receptive one with equal count", async () => {
        // Two distinct elements, each wrong twice, different directions.
        for (let i = 0; i < 2; i++) {
            await recordElementAttemptsDexie(USER, [
                attempt({
                    element_key: "recep",
                    direction: "target_to_source",
                    correct: false,
                }),
                attempt({
                    element_key: "prod",
                    direction: "source_to_target",
                    correct: false,
                }),
            ]);
        }
        // Far-future clock so both are overdue and compete on priority.
        const queue = await computeReviewQueueDexie(USER, {
            nowIso: "2030-01-01T00:00:00.000Z",
        });
        expect(queue[0].direction).toBe("source_to_target");
        expect(queue[0].element_key).toBe("prod");
        expect(queue[0].error_count).toBe(queue[1].error_count);
    });
});
