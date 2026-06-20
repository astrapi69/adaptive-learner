/**
 * Browser-side badge evaluator tests (Phase 29B).
 *
 * Pins the catalog-vs-YAML lockstep + the seed-on-first-call
 * behaviour + the predicate-fires-once rule.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {
    BUNDLED_BADGES,
    evaluateBadgesForUser,
    listBadgesWithProgress,
} from "./badges";
import {_resetDbForTests, getDb, nowIso} from "./dexie/db";

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

async function seedUser(): Promise<string> {
    const db = getDb();
    const userId = "user-1";
    await db.users.put({
        id: userId,
        name: "Tester",
        email: null,
        language: "en",
        created_at: nowIso(),
        updated_at: nowIso(),
    });
    return userId;
}

describe("BUNDLED_BADGES", () => {
    it("ships exactly 28 entries (Phase 29B spec: 20-30 + Phase 50E lessons)", () => {
        expect(BUNDLED_BADGES).toHaveLength(28);
    });

    it("has no duplicate keys", () => {
        const keys = BUNDLED_BADGES.map((b) => b.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("uses only the 5 spec categories", () => {
        const categories = new Set(BUNDLED_BADGES.map((b) => b.category));
        expect(categories).toEqual(
            new Set([
                "getting_started",
                "consistency",
                "method_explorer",
                "depth",
                "polyglot",
            ]),
        );
    });

    // --- Tiers (Phase 57 / v1.40.0). Mirrors the Python
    // test_badge_yaml tier checks so the two catalogs stay lockstep.
    it("carries the static sibling base_tier map (mirrors badges.yaml)", () => {
        const byKey = new Map(BUNDLED_BADGES.map((b) => [b.key, b]));
        const nonBronze = Object.fromEntries(
            BUNDLED_BADGES.filter(
                (b) => (b.base_tier ?? "bronze") !== "bronze",
            ).map((b) => [b.key, b.base_tier]),
        );
        expect(nonBronze).toEqual({
            sessions_50: "silver",
            sessions_100: "gold",
            level_10: "silver",
            level_25: "gold",
            streak_7_days: "silver",
            streak_30_days: "gold",
            streak_100_days: "gold",
        });
        // Flat badges default to bronze (omitted == bronze).
        expect(byKey.get("first_session")?.base_tier ?? "bronze").toBe(
            "bronze",
        );
    });

    it("only the dynamic badges carry tier_thresholds, strictly increasing", () => {
        const withTiers = BUNDLED_BADGES.filter((b) => b.tier_thresholds).map(
            (b) => b.key,
        );
        expect(new Set(withTiers)).toEqual(
            new Set(["lessons_10", "review_master"]),
        );
        for (const b of BUNDLED_BADGES) {
            if (!b.tier_thresholds) continue;
            const t = b.tier_thresholds;
            expect(Object.keys(t).sort()).toEqual(["bronze", "gold", "silver"]);
            expect(t.bronze.threshold).toBeLessThan(t.silver.threshold);
            expect(t.silver.threshold).toBeLessThan(t.gold.threshold);
            expect(t.bronze.xp_bonus).toBeLessThan(t.silver.xp_bonus);
            expect(t.silver.xp_bonus).toBeLessThan(t.gold.xp_bonus);
        }
    });
});

describe("listBadgesWithProgress", () => {
    it("seeds the catalog on first call and reports all locked", async () => {
        const userId = await seedUser();
        const out = await listBadgesWithProgress(userId);
        expect(out).toHaveLength(BUNDLED_BADGES.length);
        for (const entry of out) {
            expect(entry.earned).toBe(false);
            expect(entry.earned_at).toBeNull();
        }
    });

    it("orders by category then by key", async () => {
        const userId = await seedUser();
        const out = await listBadgesWithProgress(userId);
        for (let i = 1; i < out.length; i++) {
            if (out[i - 1].category === out[i].category) {
                expect(
                    out[i].key.localeCompare(out[i - 1].key),
                ).toBeGreaterThanOrEqual(0);
            } else {
                expect(
                    out[i].category.localeCompare(out[i - 1].category),
                ).toBeGreaterThanOrEqual(0);
            }
        }
    });
});

describe("evaluateBadgesForUser", () => {
    it("awards first_session after a completed session lands", async () => {
        const userId = await seedUser();
        const db = getDb();
        const projectId = "p1";
        await db.learningProjects.put({
            id: projectId,
            user_id: userId,
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 30,
            current_problem: null,
            active: true,
            created_at: nowIso(),
            updated_at: nowIso(),
        });
        await db.learningSessions.put({
            id: "s1",
            project_id: projectId,
            method: "deductive",
            started_at: nowIso(),
            ended_at: nowIso(),
            cycle_step: 3,
            status: "completed",
            imported_conversation_id: null,
        });
        const newly = (await evaluateBadgesForUser(userId)).earned;
        expect(newly).toContain("first_session");
    });

    it("does not re-award a badge that was already earned", async () => {
        const userId = await seedUser();
        const db = getDb();
        // Defensive: drop any seed-leaked rows from a prior test
        // (fake-indexeddb close/reopen doesn't always wipe).
        await db.userBadges.clear();
        await db.badges.clear();
        await db.learningSessions.clear();
        await db.learningProjects.clear();
        await db.users.put({
            id: userId,
            name: "Tester",
            email: null,
            language: "en",
            created_at: nowIso(),
            updated_at: nowIso(),
        });
        const projectId = "p1";
        await db.learningProjects.put({
            id: projectId,
            user_id: userId,
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 30,
            current_problem: null,
            active: true,
            created_at: nowIso(),
            updated_at: nowIso(),
        });
        await db.learningSessions.put({
            id: "s1",
            project_id: projectId,
            method: "deductive",
            started_at: nowIso(),
            ended_at: nowIso(),
            cycle_step: 3,
            status: "completed",
            imported_conversation_id: null,
        });
        const first = (await evaluateBadgesForUser(userId)).earned;
        const second = (await evaluateBadgesForUser(userId)).earned;
        expect(first).toContain("first_session");
        expect(second).not.toContain("first_session");
    });
});

// --- Lesson-badge predicates (Phase 50E / v1.33.0 / D-DEXIE-GAMIFICATION)

function buildLessonProgress(
    userId: string,
    index: number,
    opts: {correct: number; total: number; completed: boolean},
): {
    id: string;
    user_id: string;
    source: string;
    set_id: string;
    lesson_filename: string;
    status: "in_progress" | "completed";
    step_results: Record<
        string,
        {correct: number; total: number; attempts: number; completed_at: string}
    >;
    score_correct: number;
    score_total: number;
    time_spent_seconds: number;
    started_at: string;
    updated_at: string;
    completed_at: string | null;
    paused_at: string | null;
    abandoned_at: string | null;
} {
    const ts = `2026-05-${String(20 + index).padStart(2, "0")}T10:00:00Z`;
    return {
        id: `${userId}#fr-a1#${String(index).padStart(2, "0")}`,
        user_id: userId,
        source: "astrapi69/adaptive-learner-content",
        set_id: "language-fr-a1",
        lesson_filename: `${String(index).padStart(2, "0")}-lesson.json`,
        status: opts.completed ? "completed" : "in_progress",
        step_results: {
            step1: {
                correct: opts.correct,
                total: opts.total,
                attempts: 1,
                completed_at: ts,
            },
        },
        score_correct: opts.correct,
        score_total: opts.total,
        time_spent_seconds: 60,
        started_at: ts,
        updated_at: ts,
        completed_at: opts.completed ? ts : null,
        paused_at: null,
        abandoned_at: null,
    };
}

describe("evaluateBadgesForUser (lesson badges, Phase 50E)", () => {
    beforeEach(async () => {
        // The lesson predicates read lessonProgress + elementErrors;
        // the IDBFactory swap in the file-level beforeEach has been
        // observed to leak rows across tests within the same suite
        // (same workaround the lesson-xp-dexie.test.ts file uses).
        // Clear every table this describe touches before each test.
        const db = getDb();
        await db.userBadges.clear();
        await db.badges.clear();
        await db.lessonProgress.clear();
        await db.elementErrors.clear();
        await db.userXp.clear();
    });

    it("awards first_lesson after the first completed lesson lands", async () => {
        const userId = await seedUser();
        await getDb().lessonProgress.put(
            buildLessonProgress(userId, 1, {
                correct: 10,
                total: 10,
                completed: true,
            }),
        );
        const newly = (await evaluateBadgesForUser(userId)).earned;
        expect(newly).toContain("first_lesson");
        expect(newly).not.toContain("lessons_10");
    });

    it("does not award first_lesson on an in_progress lesson", async () => {
        const userId = await seedUser();
        await getDb().lessonProgress.put(
            buildLessonProgress(userId, 1, {
                correct: 5,
                total: 10,
                completed: false,
            }),
        );
        const newly = (await evaluateBadgesForUser(userId)).earned;
        expect(newly).not.toContain("first_lesson");
    });

    it("awards lessons_10 only at the 10th completion", async () => {
        const userId = await seedUser();
        const db = getDb();
        for (let i = 1; i <= 9; i++) {
            await db.lessonProgress.put(
                buildLessonProgress(userId, i, {
                    correct: 5,
                    total: 10,
                    completed: true,
                }),
            );
        }
        let newly = (await evaluateBadgesForUser(userId)).earned;
        expect(newly).not.toContain("lessons_10");
        await db.lessonProgress.put(
            buildLessonProgress(userId, 10, {
                correct: 5,
                total: 10,
                completed: true,
            }),
        );
        newly = (await evaluateBadgesForUser(userId)).earned;
        expect(newly).toContain("lessons_10");
    });

    it("awards three_star_streak after 3 consecutive 3-star completions", async () => {
        const userId = await seedUser();
        const db = getDb();
        // First: only 2 3-star lessons — not enough.
        for (let i = 1; i <= 2; i++) {
            await db.lessonProgress.put(
                buildLessonProgress(userId, i, {
                    correct: 10,
                    total: 10,
                    completed: true,
                }),
            );
        }
        let newly = (await evaluateBadgesForUser(userId)).earned;
        expect(newly).not.toContain("three_star_streak");
        // Third 3-star lesson — predicate fires.
        await db.lessonProgress.put(
            buildLessonProgress(userId, 3, {
                correct: 10,
                total: 10,
                completed: true,
            }),
        );
        newly = (await evaluateBadgesForUser(userId)).earned;
        expect(newly).toContain("three_star_streak");
    });

    it("three_star_streak ignores a 2-star lesson in the latest 3", async () => {
        const userId = await seedUser();
        const db = getDb();
        // Two older 3-star lessons (completed earlier).
        await db.lessonProgress.put(
            buildLessonProgress(userId, 1, {
                correct: 10,
                total: 10,
                completed: true,
            }),
        );
        await db.lessonProgress.put(
            buildLessonProgress(userId, 2, {
                correct: 10,
                total: 10,
                completed: true,
            }),
        );
        // Most-recent lesson is 2-star (80% — between 75% and 90%).
        await db.lessonProgress.put(
            buildLessonProgress(userId, 3, {
                correct: 8,
                total: 10,
                completed: true,
            }),
        );
        const newly = (await evaluateBadgesForUser(userId)).earned;
        expect(newly).not.toContain("three_star_streak");
    });

    it("awards review_master when 50 elements are mastered", async () => {
        const userId = await seedUser();
        const db = getDb();
        for (let i = 1; i <= 50; i++) {
            await db.elementErrors.put({
                id: `err-${i}`,
                user_id: userId,
                set_id: "language-fr-a1",
                lesson_id: "01-greetings.json",
                exercise_id: "step1",
                element_key: `el-${i}`,
                element_type: "word",
                user_answer: "",
                correct_answer: `element ${i}`,
                error_count: 0,
                correct_streak: 3,
                mastered: true,
                mastered_at: nowIso(),
                last_error_at: null,
                last_attempt_at: nowIso(),
                created_at: nowIso(),
                updated_at: nowIso(),
            });
        }
        const newly = (await evaluateBadgesForUser(userId)).earned;
        expect(newly).toContain("review_master");
    });

    it("does NOT award review_master at 49 mastered elements", async () => {
        const userId = await seedUser();
        const db = getDb();
        for (let i = 1; i <= 49; i++) {
            await db.elementErrors.put({
                id: `err-${i}`,
                user_id: userId,
                set_id: "language-fr-a1",
                lesson_id: "01-greetings.json",
                exercise_id: "step1",
                element_key: `el-${i}`,
                element_type: "word",
                user_answer: "",
                correct_answer: `element ${i}`,
                error_count: 0,
                correct_streak: 3,
                mastered: true,
                mastered_at: nowIso(),
                last_error_at: null,
                last_attempt_at: nowIso(),
                created_at: nowIso(),
                updated_at: nowIso(),
            });
        }
        const newly = (await evaluateBadgesForUser(userId)).earned;
        expect(newly).not.toContain("review_master");
    });
});

describe("badge tiers — listBadgesWithProgress + evaluate (Phase 57)", () => {
    // This describe EARNS badges, so it clears the tables it touches
    // up front (the file-level IDBFactory swap doesn't reliably wipe,
    // same workaround the lesson-badge describe uses) and is placed
    // last so an earned-badge leak can't reach a no-clear test.
    beforeEach(async () => {
        const db = getDb();
        await db.userBadges.clear();
        await db.learningSessions.clear();
        await db.learningProjects.clear();
        await db.lessonProgress.clear();
        await db.userXp.clear();
    });

    it("a locked badge previews its base tier; dynamic exposes thresholds", async () => {
        const userId = await seedUser();
        const out = await listBadgesWithProgress(userId);
        const byKey = new Map(out.map((e) => [e.key, e]));
        const sessions100 = byKey.get("sessions_100")!;
        expect(sessions100.base_tier).toBe("gold");
        expect(sessions100.tier).toBe("gold"); // locked -> previews base
        expect(sessions100.tier_thresholds).toBeNull();
        const lessons10 = byKey.get("lessons_10")!;
        expect(lessons10.tier).toBe("bronze");
        expect(lessons10.tier_thresholds?.silver.threshold).toBe(50);
    });

    it("records the badge's base_tier + updated_at on the earned row", async () => {
        const userId = await seedUser();
        const db = getDb();
        await db.learningProjects.put({
            id: "p1",
            user_id: userId,
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 30,
            current_problem: null,
            active: true,
            created_at: nowIso(),
            updated_at: nowIso(),
        });
        await db.learningSessions.put({
            id: "s1",
            project_id: "p1",
            method: "deductive",
            started_at: nowIso(),
            ended_at: nowIso(),
            cycle_step: 3,
            status: "completed",
            imported_conversation_id: null,
        });
        const newly = (await evaluateBadgesForUser(userId)).earned;
        expect(newly).toContain("first_session");
        const earned = await db.userBadges.where({user_id: userId}).toArray();
        const row = earned[0];
        expect(row.tier).toBe("bronze");
        expect(row.updated_at).toBeTruthy();
    });

    it("dynamic lessons_10 climbs bronze->silver + awards XP delta (parity w/ backend)", async () => {
        const userId = await seedUser();
        const db = getDb();
        // 10 completed lessons -> first earn at bronze, +50 XP.
        for (let i = 1; i <= 10; i++) {
            await db.lessonProgress.put(
                buildLessonProgress(userId, i, {
                    correct: 5,
                    total: 10,
                    completed: true,
                }),
            );
        }
        let res = await evaluateBadgesForUser(userId);
        expect(res.earned).toContain("lessons_10");
        expect(res.upgrades).toContainEqual({
            key: "lessons_10",
            old_tier: null,
            new_tier: "bronze",
            xp_awarded: 50,
        });
        expect((await db.userXp.where({user_id: userId}).first())?.total_xp).toBe(
            50,
        );
        // 50 completed lessons -> upgrade to silver, delta +100.
        for (let i = 11; i <= 50; i++) {
            await db.lessonProgress.put(
                buildLessonProgress(userId, i, {
                    correct: 5,
                    total: 10,
                    completed: true,
                }),
            );
        }
        res = await evaluateBadgesForUser(userId);
        expect(res.earned).not.toContain("lessons_10");
        expect(res.upgrades).toContainEqual({
            key: "lessons_10",
            old_tier: "bronze",
            new_tier: "silver",
            xp_awarded: 100,
        });
        expect((await db.userXp.where({user_id: userId}).first())?.total_xp).toBe(
            150,
        );
        // Re-evaluate at silver (still <100 lessons) -> no further upgrade.
        res = await evaluateBadgesForUser(userId);
        expect(
            res.upgrades.find((u) => u.key === "lessons_10"),
        ).toBeUndefined();
    });
});
