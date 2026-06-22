/**
 * Timed-mode configuration + helpers (#1009).
 *
 * The third lesson mode ("Auf Zeit"): every exercise has a per-question
 * countdown. The limit is per EXERCISE TYPE (not global), scaled by a
 * difficulty multiplier, and a correct answer earns a few BONUS seconds
 * carried to the next question (the Duolingo pattern — rewards speed
 * without punishing). Immediate feedback stays on; aids are optional.
 *
 * Pure + localStorage-backed (same pattern as {@link ./lessonModePref}),
 * so the timer wiring in the lesson player stays thin and testable.
 */

/** The playable exercise types (mirrors the inline union on
 *  ``ContentLessonExercise.type``). */
export type ExerciseType =
    | "matching"
    | "picture_choice"
    | "free_text"
    | "word_tiles"
    | "cloze";

/** Difficulty presets scale every base limit. */
export type TimedDifficulty = "relaxed" | "normal" | "fast";

/** Base seconds per exercise type at ``normal`` difficulty. Matching is
 *  PER PAIR (multiplied by the pair count); the rest are per question. */
export const TIMED_BASE_LIMITS: Record<ExerciseType, number> = {
    matching: 8, // per pair
    cloze: 20,
    word_tiles: 30,
    free_text: 90,
    picture_choice: 15,
};

/** Difficulty multipliers: relaxed doubles the time, fast cuts it to 0.7. */
export const TIMED_DIFFICULTY_MULTIPLIERS: Record<TimedDifficulty, number> = {
    relaxed: 2,
    normal: 1,
    fast: 0.7,
};

/** Seconds added to the NEXT question's limit after a correct answer. */
export const TIMED_BONUS_SECONDS = 5;

/** Pause (seconds) on the "time's up" message before auto-advancing. */
export const TIMED_TIMEOUT_PAUSE_SECONDS = 3;

const DIFFICULTY_KEY = "adaptive-learner.lesson.timed_difficulty";
const VALID_DIFFICULTIES: readonly TimedDifficulty[] = [
    "relaxed",
    "normal",
    "fast",
];
export const DEFAULT_TIMED_DIFFICULTY: TimedDifficulty = "normal";
export const TIMED_DIFFICULTY_OPTIONS: readonly TimedDifficulty[] =
    VALID_DIFFICULTIES;

/** The configured timed-mode difficulty, falling back to ``normal``. */
export function readTimedDifficulty(): TimedDifficulty {
    try {
        const raw = localStorage.getItem(DIFFICULTY_KEY);
        if (raw && (VALID_DIFFICULTIES as string[]).includes(raw)) {
            return raw as TimedDifficulty;
        }
    } catch {
        /* no-op: storage unavailable */
    }
    return DEFAULT_TIMED_DIFFICULTY;
}

/** Persist the timed-mode difficulty + dispatch the shared change event. */
export function writeTimedDifficulty(difficulty: TimedDifficulty): void {
    try {
        localStorage.setItem(DIFFICULTY_KEY, difficulty);
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new Event("adaptive-learner:lesson-mode-pref"),
            );
        }
    } catch {
        /* no-op: storage unavailable */
    }
}

/** The countdown limit (whole seconds, min 1) for ``type`` at the given
 *  ``difficulty``. ``pairCount`` scales the matching limit (8s per pair);
 *  ignored for the other types. Pure. */
export function timeLimitSeconds(
    type: ExerciseType,
    difficulty: TimedDifficulty,
    pairCount = 1,
): number {
    const base = TIMED_BASE_LIMITS[type] ?? 30;
    const units = type === "matching" ? Math.max(1, pairCount) : 1;
    const mult = TIMED_DIFFICULTY_MULTIPLIERS[difficulty];
    return Math.max(1, Math.round(base * units * mult));
}

/** Stats for one answered (or timed-out) question, captured per step. */
export interface TimedQuestionRecord {
    type: ExerciseType;
    /** Seconds the learner took (capped at the limit on a timeout). */
    seconds: number;
    /** True when answered within the limit (a timeout sets this false). */
    inTime: boolean;
}

export interface TimedRunStats {
    answeredInTime: number;
    total: number;
    averageSeconds: number;
    fastest: {seconds: number; type: ExerciseType} | null;
    slowest: {seconds: number; type: ExerciseType} | null;
}

/** Aggregate per-question records into the end-of-run timing summary.
 *  Pure — drives the timed-mode result block. */
export function summarizeTimedRun(
    records: readonly TimedQuestionRecord[],
): TimedRunStats {
    const total = records.length;
    if (total === 0) {
        return {
            answeredInTime: 0,
            total: 0,
            averageSeconds: 0,
            fastest: null,
            slowest: null,
        };
    }
    let answeredInTime = 0;
    let sum = 0;
    let fastest = records[0];
    let slowest = records[0];
    for (const r of records) {
        if (r.inTime) answeredInTime += 1;
        sum += r.seconds;
        if (r.seconds < fastest.seconds) fastest = r;
        if (r.seconds > slowest.seconds) slowest = r;
    }
    return {
        answeredInTime,
        total,
        averageSeconds: Math.round((sum / total) * 10) / 10,
        fastest: {seconds: fastest.seconds, type: fastest.type},
        slowest: {seconds: slowest.seconds, type: slowest.type},
    };
}
