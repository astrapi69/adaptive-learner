/**
 * Bonus-lesson rules (#2890) - the app-side convention for bonus
 * lessons inside a content set, deliberately WITHOUT a
 * learn-content-engine schema change (Aster, 2026-09-03): a lesson
 * whose FILENAME starts with ``bonus-`` is a bonus lesson. The
 * marker lives in the filename because ``listLessons`` returns bare
 * filenames, so every surface can classify without loading content.
 *
 * Unlock state is DERIVED, never stored: a set's bonus lessons
 * unlock once every regular (non-bonus) lesson is completed with at
 * least one star - read from ``LessonProgress`` through the storage
 * abstraction, so both modes agree and the state rides every backup
 * for free.
 *
 * All rules are pure (the cross-layer pinning discipline in
 * lessons/content-storage.md).
 */

import {isFlashRoundUnlocked} from "../../flash-round/flash-round";
import type {LessonProgress} from "../../../storage/types";

const BONUS_PREFIX = "bonus-";

/** Whether ``filename`` marks a bonus lesson (``bonus-*.json``). */
export function isBonusLesson(filename: string): boolean {
    return filename.toLowerCase().startsWith(BONUS_PREFIX);
}

/** The set's regular lessons - everything that is not a bonus. */
export function baseLessons(lessons: readonly string[]): string[] {
    return lessons.filter((filename) => !isBonusLesson(filename));
}

/**
 * Whether the set's bonus lessons are unlocked: every REGULAR lesson
 * is completed with at least one star (the flash-round condition,
 * applied to the base list). A set without regular lessons never
 * unlocks - a bonus-only set has nothing to finish first.
 */
export function isBonusUnlocked(
    lessons: readonly string[],
    progress: readonly LessonProgress[],
    setId: string,
): boolean {
    return isFlashRoundUnlocked(baseLessons(lessons), progress, setId);
}

/**
 * Stable listing order with every bonus lesson moved to the end -
 * a plain directory listing sorts ``bonus-*`` BEFORE ``01-*``, and a
 * bonus lesson must never sit at the top of a set (or become the
 * "start learning" target). Relative order inside each group is
 * preserved, so a manifest-declared order still wins within them.
 */
export function orderWithBonusLast(lessons: readonly string[]): string[] {
    return [...baseLessons(lessons), ...lessons.filter(isBonusLesson)];
}
