/**
 * Mission types (EXP-010 / Phase 56C). Mirror the backend
 * ``MissionTemplate`` Pydantic schema + ``UserMission`` model.
 */

export type MissionDifficulty = "easy" | "medium" | "hard";

export type MissionCategory =
    | "learning"
    | "review"
    | "mastery"
    | "exploration"
    | "streak";

export interface MissionTemplate {
    id: string;
    title_key: string;
    description_key: string;
    category: MissionCategory;
    target_value: number;
    difficulty: MissionDifficulty;
    xp_reward: number;
    icon: string;
    check_function: string;
}

/** Difficulty-mix preference from Settings (56I). */
export type DifficultyMix = "balanced" | "easy" | "challenging";

/**
 * A snapshot of "today" counters the progress evaluator reads.
 * Gathered from storage (Dexie tables or the backend) and keyed
 * by ``check_function`` name.
 */
export interface MissionStats {
    lessons_completed_today: number;
    lessons_min_2_stars_today: number;
    lessons_min_3_stars_today: number;
    new_sets_started_today: number;
    elements_reviewed_today: number;
    review_sessions_completed_today: number;
    overdue_cleared_today: number;
    elements_mastered_today: number;
    perfect_lessons_today: number;
    adaptive_lessons_started_today: number;
    cloze_exercises_today: number;
    exercise_types_used_today: number;
    minutes_learned_today: number;
    streak_kept_today: number;
    current_streak_days: number;
    weekend_learning_today: number;
}

/** Inputs that shape WHICH missions a user is eligible for. */
export interface MissionProfile {
    /** Lifetime completed lessons (drives new/active/veteran). */
    lessonsCompleted: number;
    /** Whether the user has any non-mastered element errors. */
    hasErrors: boolean;
    /** Gamification level (veterans get harder variants). */
    level: number;
    /** Whether the assignment day is a weekend. */
    isWeekend: boolean;
}

/** A mission assigned to a user for a given day, with its
 *  resolved template + live progress (the UI shape). */
export interface DailyMission {
    id: string;
    template_id: string;
    assigned_date: string;
    progress: number;
    target: number;
    completed: boolean;
    xp_awarded: boolean;
    template: MissionTemplate;
}
