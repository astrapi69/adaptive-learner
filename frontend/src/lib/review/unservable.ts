/**
 * Which due rows can no question be built for, and why (#3952).
 *
 * A review question replays the row's source exercise, so a row is
 * unservable when that exercise cannot be found, or when answering it can
 * never reach the row. Three causes are permanent and get a reason; the row
 * is then retired and leaves every due count:
 *
 * - ``exercise_missing``: the lesson loaded and does not hold the exercise.
 * - ``lesson_missing``: the set's lesson listing loaded, is not empty, and
 *   does not hold the lesson.
 * - ``element_missing`` (#3958): the exercise is still there, but the
 *   question built for the row records under none of the row's keys (a
 *   matching pair removed by an update). The row would be asked in every
 *   session and never advance.
 *
 * Anything else gets NO reason: a lesson that failed to load while the
 * listing still names it (offline, a fetch error), an unreadable listing, or
 * an empty one (the set is not downloaded). Such a row stays as it is and is
 * served again once the lesson loads; nothing is stored that would have to
 * be undone.
 *
 * Pure: the caller loads the lessons and the listing.
 */

import {elementFormerKeysOf, elementIdentityKeysOf} from "../srs/element-identity";
import {matchesExerciseIdentity} from "../srs/exercise-identity";
import type {ContentLesson, UnservableReason} from "../../storage/types";
import {_buildReviewStep, type ReviewSourceRow} from "./review-lesson";

/** Row ids to retire, per permanent reason. */
export type UnservableRows = Record<UnservableReason, string[]>;

/** What the classification reads of a row (a queue item or a stored row). */
export type ElementRowRef = ReviewSourceRow;

function holdsExercise(lesson: ContentLesson, exerciseId: string): boolean {
    return lesson.steps.some(
        (step) => step.exercise != null && matchesExerciseIdentity(step.exercise, exerciseId),
    );
}

/**
 * Whether answering the question built for ``row`` can record under the
 * row's own key. Judged on the step the session would really serve, so a
 * generated cloze (which carries the row's key) counts as reaching it. A
 * former key counts beside the current one (the element's text, or a
 * multiple choice's text-or-id mix, #3962): a row written before the id was
 * minted is a re-key case (#3960), not a missing element. An exercise type
 * whose key rule is not known here is no evidence, so it reaches.
 */
function answerReachesRow(row: ElementRowRef, lesson: ContentLesson): boolean {
    const exercise = _buildReviewStep(row, lesson)?.exercise;
    if (!exercise) return true;
    const identityKeys = elementIdentityKeysOf(exercise);
    if (identityKeys === null) return true;
    return (
        identityKeys.includes(row.element_key) ||
        (elementFormerKeysOf(exercise) ?? []).flat().includes(row.element_key)
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
 * @param awaitsRekey names a row another mechanism can still re-key (the
 *   #2161 recovery); such a row is never ``element_missing``.
 * @example
 * const {exercise_missing, lesson_missing, element_missing} = classifyUnservable(queue, lessons, listing);
 */
export function classifyUnservable(
    queue: readonly ElementRowRef[],
    loadedLessons: ReadonlyMap<string, ContentLesson>,
    listedLessons: readonly string[] | null,
    awaitsRekey: (row: ElementRowRef, lesson: ContentLesson) => boolean = () => false,
): UnservableRows {
    const result: UnservableRows = {exercise_missing: [], lesson_missing: [], element_missing: []};
    const listingIsEvidence = listedLessons !== null && listedLessons.length > 0;
    for (const item of queue) {
        const lesson = loadedLessons.get(item.lesson_id);
        if (lesson) {
            if (!holdsExercise(lesson, item.exercise_id)) result.exercise_missing.push(item.id);
            else if (!answerReachesRow(item, lesson) && !awaitsRekey(item, lesson)) {
                result.element_missing.push(item.id);
            }
        } else if (listingIsEvidence && !listedLessons.includes(item.lesson_id)) {
            result.lesson_missing.push(item.id);
        }
    }
    return result;
}
