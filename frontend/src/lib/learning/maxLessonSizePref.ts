/**
 * Maximum lesson size preference (Phase 63I / EXP-020).
 *
 * Controls how many steps a lesson may have before the
 * Save-as-Offline-Lesson flow splits it into multiple parts.
 * Stored in localStorage so it survives page reloads and applies
 * in both storage modes (API + Dexie).
 *
 * Range: 5–20 steps; default 10 (matches ``DEFAULT_MAX_STEPS``
 * in ``lesson-splitter.ts``).
 */

export const MAX_LESSON_SIZE_PREF_KEY =
    "adaptive-learner.max_lesson_size";

export const DEFAULT_MAX_LESSON_SIZE = 10;
export const MIN_MAX_LESSON_SIZE = 5;
export const MAX_MAX_LESSON_SIZE = 20;

/** The configured maximum lesson size, clamped to
 *  ``[MIN_MAX_LESSON_SIZE, MAX_MAX_LESSON_SIZE]`` (falls back to the
 *  default for a missing / out-of-range / non-numeric value). */
export function readMaxLessonSize(): number {
    try {
        const raw = localStorage.getItem(MAX_LESSON_SIZE_PREF_KEY);
        if (raw === null) return DEFAULT_MAX_LESSON_SIZE;
        const parsed = parseInt(raw, 10);
        if (
            isNaN(parsed) ||
            parsed < MIN_MAX_LESSON_SIZE ||
            parsed > MAX_MAX_LESSON_SIZE
        ) {
            return DEFAULT_MAX_LESSON_SIZE;
        }
        return parsed;
    } catch {
        return DEFAULT_MAX_LESSON_SIZE;
    }
}

/** Persist the maximum lesson size (best-effort; ignored when
 *  localStorage is unavailable). */
export function writeMaxLessonSize(size: number): void {
    try {
        localStorage.setItem(MAX_LESSON_SIZE_PREF_KEY, String(size));
    } catch {
        /* localStorage unavailable */
    }
}
