/**
 * Browser-side badge catalog + evaluator (Phase 29B).
 *
 * Mirrors ``adaptive_learner_gamification.badge_service`` so a
 * Dexie-mode user earns the same badges as an API-mode user.
 * The catalog is seeded once on first ``listBadges`` call from
 * the bundled YAML constant below — kept in-source to avoid a
 * runtime YAML dependency in the browser bundle.
 */

import {getDb, newId, nowIso} from "./db";
import type {BadgeRow, UserBadgeRow} from "./db";
import {computeLevel} from "./gamification";
import type {BadgeWithProgress} from "./types";

/**
 * Catalog mirror of ``badges.yaml``. MUST stay in lockstep with
 * the YAML — a Vitest pin asserts the two have identical keys.
 */
export const BUNDLED_BADGES: ReadonlyArray<{
    key: string;
    name_key: string;
    description_key: string;
    icon: string;
    category: string;
}> = [
    // Getting Started
    {
        key: "first_session",
        name_key: "gamification.badges.first_session.name",
        description_key: "gamification.badges.first_session.description",
        icon: "rocket",
        category: "getting_started",
    },
    {
        key: "first_assessment",
        name_key: "gamification.badges.first_assessment.name",
        description_key: "gamification.badges.first_assessment.description",
        icon: "target",
        category: "getting_started",
    },
    {
        key: "first_import",
        name_key: "gamification.badges.first_import.name",
        description_key: "gamification.badges.first_import.description",
        icon: "inbox",
        category: "getting_started",
    },
    // Consistency
    {
        key: "streak_3_days",
        name_key: "gamification.badges.streak_3_days.name",
        description_key: "gamification.badges.streak_3_days.description",
        icon: "flame",
        category: "consistency",
    },
    {
        key: "streak_7_days",
        name_key: "gamification.badges.streak_7_days.name",
        description_key: "gamification.badges.streak_7_days.description",
        icon: "flame",
        category: "consistency",
    },
    {
        key: "streak_30_days",
        name_key: "gamification.badges.streak_30_days.name",
        description_key: "gamification.badges.streak_30_days.description",
        icon: "flame",
        category: "consistency",
    },
    {
        key: "streak_100_days",
        name_key: "gamification.badges.streak_100_days.name",
        description_key: "gamification.badges.streak_100_days.description",
        icon: "flame",
        category: "consistency",
    },
    // Method Explorer
    {
        key: "all_six_methods",
        name_key: "gamification.badges.all_six_methods.name",
        description_key: "gamification.badges.all_six_methods.description",
        icon: "compass",
        category: "method_explorer",
    },
    {
        key: "deductive_10",
        name_key: "gamification.badges.deductive_10.name",
        description_key: "gamification.badges.deductive_10.description",
        icon: "brain",
        category: "method_explorer",
    },
    {
        key: "inductive_10",
        name_key: "gamification.badges.inductive_10.name",
        description_key: "gamification.badges.inductive_10.description",
        icon: "brain",
        category: "method_explorer",
    },
    {
        key: "error_based_10",
        name_key: "gamification.badges.error_based_10.name",
        description_key: "gamification.badges.error_based_10.description",
        icon: "brain",
        category: "method_explorer",
    },
    {
        key: "dialogic_10",
        name_key: "gamification.badges.dialogic_10.name",
        description_key: "gamification.badges.dialogic_10.description",
        icon: "brain",
        category: "method_explorer",
    },
    {
        key: "contextual_10",
        name_key: "gamification.badges.contextual_10.name",
        description_key: "gamification.badges.contextual_10.description",
        icon: "brain",
        category: "method_explorer",
    },
    {
        key: "ai_adaptive_10",
        name_key: "gamification.badges.ai_adaptive_10.name",
        description_key: "gamification.badges.ai_adaptive_10.description",
        icon: "brain",
        category: "method_explorer",
    },
    // Depth
    {
        key: "five_cycles_one_session",
        name_key: "gamification.badges.five_cycles_one_session.name",
        description_key:
            "gamification.badges.five_cycles_one_session.description",
        icon: "layers",
        category: "depth",
    },
    {
        key: "sessions_10",
        name_key: "gamification.badges.sessions_10.name",
        description_key: "gamification.badges.sessions_10.description",
        icon: "book",
        category: "depth",
    },
    {
        key: "sessions_50",
        name_key: "gamification.badges.sessions_50.name",
        description_key: "gamification.badges.sessions_50.description",
        icon: "book",
        category: "depth",
    },
    {
        key: "sessions_100",
        name_key: "gamification.badges.sessions_100.name",
        description_key: "gamification.badges.sessions_100.description",
        icon: "book",
        category: "depth",
    },
    {
        key: "level_5",
        name_key: "gamification.badges.level_5.name",
        description_key: "gamification.badges.level_5.description",
        icon: "star",
        category: "depth",
    },
    {
        key: "level_10",
        name_key: "gamification.badges.level_10.name",
        description_key: "gamification.badges.level_10.description",
        icon: "star",
        category: "depth",
    },
    {
        key: "level_25",
        name_key: "gamification.badges.level_25.name",
        description_key: "gamification.badges.level_25.description",
        icon: "star",
        category: "depth",
    },
    // Polyglot
    {
        key: "two_languages",
        name_key: "gamification.badges.two_languages.name",
        description_key: "gamification.badges.two_languages.description",
        icon: "globe",
        category: "polyglot",
    },
    {
        key: "three_providers",
        name_key: "gamification.badges.three_providers.name",
        description_key: "gamification.badges.three_providers.description",
        icon: "sparkles",
        category: "polyglot",
    },
    {
        key: "import_10_conversations",
        name_key: "gamification.badges.import_10_conversations.name",
        description_key:
            "gamification.badges.import_10_conversations.description",
        icon: "inbox",
        category: "polyglot",
    },
    // Content lessons (Phase 46E.2 / v1.31.0 — Python-side
    // catalog and predicates landed; Phase 50E / v1.33.0 ports
    // the Dexie-side predicates so Dexie-mode users earn the
    // same badges.)
    {
        key: "first_lesson",
        name_key: "gamification.badges.first_lesson.name",
        description_key: "gamification.badges.first_lesson.description",
        icon: "book-open",
        category: "getting_started",
    },
    {
        key: "lessons_10",
        name_key: "gamification.badges.lessons_10.name",
        description_key: "gamification.badges.lessons_10.description",
        icon: "book-open",
        category: "depth",
    },
    {
        key: "three_star_streak",
        name_key: "gamification.badges.three_star_streak.name",
        description_key: "gamification.badges.three_star_streak.description",
        icon: "star",
        category: "consistency",
    },
    {
        key: "review_master",
        name_key: "gamification.badges.review_master.name",
        description_key: "gamification.badges.review_master.description",
        icon: "repeat",
        category: "depth",
    },
];

async function ensureCatalogSeeded(): Promise<Map<string, BadgeRow>> {
    const db = getDb();
    const existing = await db.badges.toArray();
    if (existing.length === BUNDLED_BADGES.length) {
        return new Map(existing.map((b) => [b.key, b]));
    }
    const now = nowIso();
    const existingByKey = new Map(existing.map((b) => [b.key, b]));
    for (const spec of BUNDLED_BADGES) {
        if (existingByKey.has(spec.key)) {
            continue;
        }
        const row: BadgeRow = {
            id: newId(),
            key: spec.key,
            name_key: spec.name_key,
            description_key: spec.description_key,
            icon: spec.icon,
            category: spec.category,
            created_at: now,
            updated_at: now,
        };
        await db.badges.put(row);
        existingByKey.set(spec.key, row);
    }
    return existingByKey;
}

async function completedSessionCount(userId: string): Promise<number> {
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) return 0;
    const sessions = await db.learningSessions
        .filter(
            (s) => projectIds.has(s.project_id) && s.status === "completed",
        )
        .toArray();
    return sessions.length;
}

async function sessionsForMethod(
    userId: string,
    method: string,
): Promise<number> {
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) return 0;
    const rows = await db.learningSessions
        .filter(
            (s) =>
                projectIds.has(s.project_id) &&
                s.method === method &&
                s.status === "completed",
        )
        .toArray();
    return rows.length;
}

async function distinctMethodsUsed(userId: string): Promise<Set<string>> {
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) return new Set();
    const sessions = await db.learningSessions
        .filter(
            (s) => projectIds.has(s.project_id) && s.status === "completed",
        )
        .toArray();
    return new Set(sessions.map((s) => s.method));
}

async function currentStreakDaysForUser(userId: string): Promise<number> {
    const {currentStreakDays} = await import("./gamification");
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) return 0;
    const sessions = await db.learningSessions
        .filter((s) => projectIds.has(s.project_id))
        .toArray();
    const days = new Set<string>();
    for (const s of sessions) {
        if (s.started_at) days.add(s.started_at.slice(0, 10));
    }
    const today = nowIso().slice(0, 10);
    return currentStreakDays(days, today);
}

async function userLevel(userId: string): Promise<number> {
    const db = getDb();
    const row = await db.userXp.where({user_id: userId}).first();
    if (!row) return 1;
    return computeLevel(row.total_xp);
}

async function hasAssessment(userId: string): Promise<boolean> {
    const db = getDb();
    const profile = await db.learningProfiles
        .where({user_id: userId})
        .first();
    return profile !== undefined;
}

async function importCount(userId: string): Promise<number> {
    const db = getDb();
    return await db.importedConversations.where({user_id: userId}).count();
}

async function providerCount(userId: string): Promise<number> {
    const db = getDb();
    const settings = await db.userSettings.where({user_id: userId}).first();
    if (!settings) return 0;
    return [
        settings.api_key_anthropic,
        settings.api_key_openai,
        settings.api_key_gemini,
    ].filter(Boolean).length;
}

async function languagesUsed(userId: string): Promise<number> {
    const db = getDb();
    const langs = new Set<string>();
    const user = await db.users.get(userId);
    if (user?.language) langs.add(user.language);
    const settings = await db.userSettings.where({user_id: userId}).first();
    if (settings?.language) langs.add(settings.language);
    const curricula = await db.curricula.where({user_id: userId}).toArray();
    for (const c of curricula) {
        if (c.language) langs.add(c.language);
    }
    return langs.size;
}

async function maxCycleCountInOneSession(userId: string): Promise<number> {
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) return 0;
    const sessions = await db.learningSessions
        .filter((s) => projectIds.has(s.project_id))
        .toArray();
    let max = 0;
    for (const s of sessions) {
        // ``cycle_count`` was added in v1.4.0 / Phase 17 but the
        // Dexie row type doesn't carry it as a typed field; read
        // defensively.
        const cc = Number((s as unknown as {cycle_count?: number}).cycle_count ?? 0);
        if (cc > max) max = cc;
    }
    return max;
}

// --- Lesson-badge helpers (Phase 50E / v1.33.0 / D-DEXIE-GAMIFICATION)
//
// Mirror the Python helpers in ``badge_service.py``:
//   _completed_lesson_count, _last_n_lessons_all_three_star,
//   _mastered_elements_count.

async function completedLessonCount(userId: string): Promise<number> {
    const db = getDb();
    return await db.lessonProgress
        .where({user_id: userId})
        .filter((row) => row.status === "completed")
        .count();
}

async function lastNLessonsAllThreeStar(
    userId: string,
    n: number,
): Promise<boolean> {
    const db = getDb();
    const rows = await db.lessonProgress
        .where({user_id: userId})
        .filter((row) => row.status === "completed")
        .toArray();
    if (rows.length < n) {
        return false;
    }
    // Order by completed_at desc; rows without completed_at sort to
    // the end (newest-first equivalent of Python's
    // ``order_by(completed_at.desc()).limit(n)``).
    rows.sort((a, b) => {
        const ac = a.completed_at ?? "";
        const bc = b.completed_at ?? "";
        return bc.localeCompare(ac);
    });
    const top = rows.slice(0, n);
    const {computeStars} = await import("../lib/gamification/lesson-xp");
    return top.every(
        (row) => computeStars(row.score_correct, row.score_total) === 3,
    );
}

async function masteredElementsCount(userId: string): Promise<number> {
    const db = getDb();
    return await db.elementErrors
        .where({user_id: userId})
        .filter((row) => row.mastered === true)
        .count();
}

type Evaluator = (userId: string) => Promise<boolean>;

const EVALUATORS: Record<string, Evaluator> = {
    first_session: async (uid) => (await completedSessionCount(uid)) >= 1,
    first_assessment: async (uid) => await hasAssessment(uid),
    first_import: async (uid) => (await importCount(uid)) >= 1,
    streak_3_days: async (uid) => (await currentStreakDaysForUser(uid)) >= 3,
    streak_7_days: async (uid) => (await currentStreakDaysForUser(uid)) >= 7,
    streak_30_days: async (uid) => (await currentStreakDaysForUser(uid)) >= 30,
    streak_100_days: async (uid) =>
        (await currentStreakDaysForUser(uid)) >= 100,
    all_six_methods: async (uid) =>
        (await distinctMethodsUsed(uid)).size >= 6,
    deductive_10: async (uid) =>
        (await sessionsForMethod(uid, "deductive")) >= 10,
    inductive_10: async (uid) =>
        (await sessionsForMethod(uid, "inductive")) >= 10,
    error_based_10: async (uid) =>
        (await sessionsForMethod(uid, "error_based")) >= 10,
    dialogic_10: async (uid) =>
        (await sessionsForMethod(uid, "dialogic")) >= 10,
    contextual_10: async (uid) =>
        (await sessionsForMethod(uid, "contextual")) >= 10,
    ai_adaptive_10: async (uid) =>
        (await sessionsForMethod(uid, "ai_adaptive")) >= 10,
    five_cycles_one_session: async (uid) =>
        (await maxCycleCountInOneSession(uid)) >= 5,
    sessions_10: async (uid) => (await completedSessionCount(uid)) >= 10,
    sessions_50: async (uid) => (await completedSessionCount(uid)) >= 50,
    sessions_100: async (uid) => (await completedSessionCount(uid)) >= 100,
    level_5: async (uid) => (await userLevel(uid)) >= 5,
    level_10: async (uid) => (await userLevel(uid)) >= 10,
    level_25: async (uid) => (await userLevel(uid)) >= 25,
    two_languages: async (uid) => (await languagesUsed(uid)) >= 2,
    three_providers: async (uid) => (await providerCount(uid)) >= 3,
    import_10_conversations: async (uid) => (await importCount(uid)) >= 10,
    // Lesson badges (Phase 50E / v1.33.0 / D-DEXIE-GAMIFICATION).
    first_lesson: async (uid) => (await completedLessonCount(uid)) >= 1,
    lessons_10: async (uid) => (await completedLessonCount(uid)) >= 10,
    three_star_streak: async (uid) => await lastNLessonsAllThreeStar(uid, 3),
    review_master: async (uid) => (await masteredElementsCount(uid)) >= 50,
};

/**
 * Run every evaluator + insert newly-earned ``user_badges``
 * rows. Returns the list of badge KEYS earned this call.
 */
export async function evaluateBadgesForUser(
    userId: string,
): Promise<string[]> {
    const catalog = await ensureCatalogSeeded();
    const db = getDb();
    const earnedRows = await db.userBadges.where({user_id: userId}).toArray();
    const earnedBadgeIds = new Set(earnedRows.map((r) => r.badge_id));
    const newlyEarned: string[] = [];
    for (const [key, predicate] of Object.entries(EVALUATORS)) {
        const badge = catalog.get(key);
        if (!badge) continue;
        if (earnedBadgeIds.has(badge.id)) continue;
        try {
            if (await predicate(userId)) {
                const row: UserBadgeRow = {
                    id: newId(),
                    user_id: userId,
                    badge_id: badge.id,
                    earned_at: nowIso(),
                };
                await db.userBadges.put(row);
                newlyEarned.push(key);
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(`Badge evaluator ${key} threw`, err);
        }
    }
    return newlyEarned;
}

/** Catalog + per-user earn state for the dashboard showcase. */
export async function listBadgesWithProgress(
    userId: string,
): Promise<BadgeWithProgress[]> {
    const catalog = await ensureCatalogSeeded();
    const db = getDb();
    const earned = await db.userBadges.where({user_id: userId}).toArray();
    const earnedMap = new Map(earned.map((r) => [r.badge_id, r.earned_at]));
    const out: BadgeWithProgress[] = [];
    for (const badge of Array.from(catalog.values()).sort((a, b) => {
        const c = a.category.localeCompare(b.category);
        return c !== 0 ? c : a.key.localeCompare(b.key);
    })) {
        const earnedAt = earnedMap.get(badge.id);
        out.push({
            key: badge.key,
            name_key: badge.name_key,
            description_key: badge.description_key,
            icon: badge.icon,
            category: badge.category,
            earned: earnedAt !== undefined,
            earned_at: earnedAt ?? null,
            progress: null,
        });
    }
    return out;
}
