/**
 * Lesson-mode preferences (#1007).
 *
 * Two learner-facing settings, persisted in localStorage (the same
 * pattern as {@link ./matchingResolvePref} / {@link ./reviewLimitPref}):
 *
 *   - **default lesson mode** — which mode a lesson starts in:
 *     ``practice`` (scaffolding on: theory recap, hints, auto-read,
 *     solution toggles, immediate feedback) or ``exam`` (those aids
 *     hidden — the "testing effect": retrieve without aids). Default
 *     ``practice`` so new learners get the lower-pressure mode.
 *   - **exam pass threshold** — the percentage of correct answers needed
 *     to "pass" an exam-mode run, shown on the summary. Default 60%.
 *
 * Presentation/UX only: neither changes scoring or the SRS layer here.
 */

export type LessonMode =
    | "practice"
    | "exam"
    | "timed"
    | "error"
    | "reverse"
    | "shuffle"
    | "endless";

/** Valid exam pass thresholds (percent correct). */
export type ExamPassThreshold = 60 | 70 | 80;

const MODE_KEY = "adaptive-learner.lesson.default_mode";
const THRESHOLD_KEY = "adaptive-learner.lesson.exam_pass_threshold";

const VALID_MODES: readonly LessonMode[] = [
    "practice",
    "exam",
    "timed",
    "error",
    "reverse",
    "shuffle",
    "endless",
];
const VALID_THRESHOLDS: readonly ExamPassThreshold[] = [60, 70, 80];

export const DEFAULT_LESSON_MODE: LessonMode = "practice";
export const DEFAULT_EXAM_PASS_THRESHOLD: ExamPassThreshold = 60;

export const LESSON_MODE_OPTIONS: readonly LessonMode[] = VALID_MODES;
export const EXAM_PASS_THRESHOLD_OPTIONS: readonly ExamPassThreshold[] =
    VALID_THRESHOLDS;

/** Dispatched on the window when a lesson-mode preference changes in THIS
 *  tab (the native ``storage`` event only fires in other tabs). */
export const LESSON_MODE_PREF_CHANGE_EVENT = "adaptive-learner:lesson-mode-pref";

/** The configured default lesson mode, falling back to ``practice``. */
export function readDefaultLessonMode(): LessonMode {
    try {
        const raw = localStorage.getItem(MODE_KEY);
        if (raw && (VALID_MODES as string[]).includes(raw)) {
            return raw as LessonMode;
        }
    } catch {
        /* no-op: storage unavailable */
    }
    return DEFAULT_LESSON_MODE;
}

/** Persist the default lesson mode + dispatch the change event. */
export function writeDefaultLessonMode(mode: LessonMode): void {
    try {
        localStorage.setItem(MODE_KEY, mode);
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(LESSON_MODE_PREF_CHANGE_EVENT));
        }
    } catch {
        /* no-op: storage unavailable */
    }
}

/** The configured exam pass threshold (percent), falling back to 60. */
export function readExamPassThreshold(): ExamPassThreshold {
    try {
        const raw = localStorage.getItem(THRESHOLD_KEY);
        const parsed = raw == null ? NaN : Number(raw);
        if ((VALID_THRESHOLDS as number[]).includes(parsed)) {
            return parsed as ExamPassThreshold;
        }
    } catch {
        /* no-op: storage unavailable */
    }
    return DEFAULT_EXAM_PASS_THRESHOLD;
}

/** Persist the exam pass threshold + dispatch the change event. */
export function writeExamPassThreshold(threshold: ExamPassThreshold): void {
    try {
        localStorage.setItem(THRESHOLD_KEY, String(threshold));
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(LESSON_MODE_PREF_CHANGE_EVENT));
        }
    } catch {
        /* no-op: storage unavailable */
    }
}

/** Whether ``correct`` of ``total`` answers passes ``threshold`` percent.
 *  Empty lessons (``total === 0``) never pass. Pure — drives the
 *  exam-mode summary pass/fail line. */
export function examPassed(
    correct: number,
    total: number,
    threshold: ExamPassThreshold,
): boolean {
    if (total <= 0) return false;
    return (correct / total) * 100 >= threshold;
}
