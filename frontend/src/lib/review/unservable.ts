/**
 * Which due rows can no question be built for, and why (#3952).
 *
 * A review question replays the row's source exercise, so a row is
 * unservable when that exercise cannot be found. Two causes are permanent
 * and get a reason; the row is then retired and leaves every due count:
 *
 * - ``exercise_missing``: the lesson loaded and does not hold the exercise.
 * - ``lesson_missing``: the set's lesson listing loaded, is not empty, and
 *   does not hold the lesson.
 *
 * Anything else gets NO reason: a lesson that failed to load while the
 * listing still names it (offline, a fetch error), an unreadable listing, or
 * an empty one (the set is not downloaded). Such a row stays as it is and is
 * served again once the lesson loads; nothing is stored that would have to
 * be undone.
 *
 * Pure: the caller loads the lessons and the listing.
 */

import {matchesExerciseIdentity} from "../srs/exercise-identity";
import type {ContentLesson, UnservableReason} from "../../storage/types";

/** Row ids to retire, per permanent reason. */
export type UnservableRows = Record<UnservableReason, string[]>;

/** What the classification reads of a row (a queue item or a stored row). */
export interface ElementRowRef {
    id: string;
    lesson_id: string;
    exercise_id: string;
}

function holdsExercise(lesson: ContentLesson, exerciseId: string): boolean {
    return lesson.steps.some(
        (step) => step.exercise != null && matchesExerciseIdentity(step.exercise, exerciseId),
    );
}

/**
 * Sort the queue's unservable rows by permanent cause.
 *
 * @param queue the rows to judge (not de-duplicated: each direction of an
 *   element is its own row).
 * @param loadedLessons the lessons that loaded, keyed by ``lesson_id``.
 * @param listedLessons the set's lesson listing, or ``null`` when it could
 *   not be read.
 * @example
 * const {exercise_missing, lesson_missing} = classifyUnservable(queue, lessons, listing);
 */
export function classifyUnservable(
    queue: readonly ElementRowRef[],
    loadedLessons: ReadonlyMap<string, ContentLesson>,
    listedLessons: readonly string[] | null,
): UnservableRows {
    const result: UnservableRows = {exercise_missing: [], lesson_missing: []};
    const listingIsEvidence = listedLessons !== null && listedLessons.length > 0;
    for (const item of queue) {
        const lesson = loadedLessons.get(item.lesson_id);
        if (lesson) {
            if (!holdsExercise(lesson, item.exercise_id)) result.exercise_missing.push(item.id);
        } else if (listingIsEvidence && !listedLessons.includes(item.lesson_id)) {
            result.lesson_missing.push(item.id);
        }
    }
    return result;
}
