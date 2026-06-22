/**
 * Lesson-mode config objects (#1011).
 *
 * Each lesson mode is pure data: a {@link LessonModeConfig} of boolean
 * flags + scalars that the player and the exercise/help components READ
 * (via ``useLessonMode``) instead of branching on a mode string. Adding a
 * mode = adding one row to {@link MODE_CONFIGS}; the components never change.
 *
 * Flags:
 * - ``showHints`` / ``showTheoryRecap`` / ``showReadAloud`` — scaffolding
 *   aids gated in the respective components.
 * - ``showResolve`` / ``showAnswerToggle`` — the post-check solution reveal
 *   (matching "Auflösen" + the word-tiles My-answer / Solution toggle).
 * - ``immediateFeedback`` — per-question correct/wrong + celebration.
 * - ``timeLimit`` (seconds, ``null`` = none; timed mode derives it per
 *   exercise type) + ``timeBonusOnCorrect``.
 * - ``xpMultiplier`` — reward weight for the mode.
 * - ``cardSource`` / ``cardDirection`` / ``sessionEnd`` — drive the
 *   card-source modes (error / reverse / shuffle / endless); the player
 *   reads them where those modes are wired.
 */

import type {LessonMode} from "./lessonModePref";

export interface LessonModeConfig {
    mode: LessonMode;
    showHints: boolean;
    showTheoryRecap: boolean;
    showReadAloud: boolean;
    showResolve: boolean;
    showAnswerToggle: boolean;
    immediateFeedback: boolean;
    /** Seconds per question; ``null`` = no limit (timed derives per type). */
    timeLimit: number | null;
    /** Bonus seconds carried to the next question on a correct answer. */
    timeBonusOnCorrect: number;
    xpMultiplier: number;
    cardSource: "lesson" | "errors" | "set-shuffle" | "srs";
    cardDirection: "normal" | "reverse";
    sessionEnd: "fixed" | "endless";
}

const BASE: Omit<LessonModeConfig, "mode"> = {
    showHints: true,
    showTheoryRecap: true,
    showReadAloud: true,
    showResolve: true,
    showAnswerToggle: true,
    immediateFeedback: true,
    timeLimit: null,
    timeBonusOnCorrect: 0,
    xpMultiplier: 1.0,
    cardSource: "lesson",
    cardDirection: "normal",
    sessionEnd: "fixed",
};

export const MODE_CONFIGS: Record<LessonMode, LessonModeConfig> = {
    practice: {...BASE, mode: "practice"},
    exam: {
        ...BASE,
        mode: "exam",
        showHints: false,
        showTheoryRecap: false,
        showReadAloud: false,
        showResolve: false,
        showAnswerToggle: false,
        immediateFeedback: false,
        xpMultiplier: 1.5,
    },
    timed: {
        ...BASE,
        mode: "timed",
        showTheoryRecap: false,
        showReadAloud: false,
        timeBonusOnCorrect: 5,
        xpMultiplier: 1.25,
    },
    error: {...BASE, mode: "error", cardSource: "errors"},
    reverse: {
        ...BASE,
        mode: "reverse",
        cardDirection: "reverse",
        xpMultiplier: 1.25,
    },
    shuffle: {
        ...BASE,
        mode: "shuffle",
        showTheoryRecap: false,
        cardSource: "set-shuffle",
    },
    endless: {
        ...BASE,
        mode: "endless",
        showTheoryRecap: false,
        cardSource: "srs",
        sessionEnd: "endless",
    },
};

/** The config for ``mode`` (falls back to practice for an unknown id). */
export function configForMode(mode: LessonMode): LessonModeConfig {
    return MODE_CONFIGS[mode] ?? MODE_CONFIGS.practice;
}
