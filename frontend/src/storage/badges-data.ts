/**
 * Bundled badge catalog data (Phase 58 extraction).
 *
 * Pure data — NO imports from db.ts — so it can be statically imported
 * by both badges.ts (seeder/evaluator) and db.ts (the v21 upgrade
 * backfill) WITHOUT the badges.ts -> db.ts import cycle. db.ts needs
 * it synchronously: a dynamic ``await import()`` inside the Dexie
 * upgrade transaction finishes the IDB transaction mid-flight
 * (DatabaseClosedError), which broke the v1.40.0 (schema v21) upgrade.
 *
 * MUST stay in lockstep with backend/config/.../badges.yaml — a Vitest
 * pin asserts identical keys.
 */

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
    // Phase 57 / v1.40.0. ``base_tier`` defaults to "bronze" when
    // omitted. ``tier_thresholds`` is set only for DYNAMIC badges.
    base_tier?: string;
    tier_thresholds?: Record<string, {threshold: number; xp_bonus: number}>;
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
        base_tier: "silver",
    },
    {
        key: "streak_30_days",
        name_key: "gamification.badges.streak_30_days.name",
        description_key: "gamification.badges.streak_30_days.description",
        icon: "flame",
        category: "consistency",
        base_tier: "gold",
    },
    {
        key: "streak_100_days",
        name_key: "gamification.badges.streak_100_days.name",
        description_key: "gamification.badges.streak_100_days.description",
        icon: "flame",
        category: "consistency",
        base_tier: "gold",
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
        base_tier: "silver",
    },
    {
        key: "sessions_100",
        name_key: "gamification.badges.sessions_100.name",
        description_key: "gamification.badges.sessions_100.description",
        icon: "book",
        category: "depth",
        base_tier: "gold",
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
        base_tier: "silver",
    },
    {
        key: "level_25",
        name_key: "gamification.badges.level_25.name",
        description_key: "gamification.badges.level_25.description",
        icon: "star",
        category: "depth",
        base_tier: "gold",
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
        tier_thresholds: {
            bronze: {threshold: 10, xp_bonus: 50},
            silver: {threshold: 50, xp_bonus: 150},
            gold: {threshold: 100, xp_bonus: 300},
        },
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
        tier_thresholds: {
            bronze: {threshold: 50, xp_bonus: 50},
            silver: {threshold: 200, xp_bonus: 150},
            gold: {threshold: 500, xp_bonus: 300},
        },
    },
];
