/**
 * error-replay — extract the exercises a learner got WRONG in a
 * lesson run, for the "Fehler wiederholen" / "Retry Errors" flow.
 *
 * Distinct from the other error surfaces:
 *   - Correction Block generates NEW cloze exercises from errors.
 *   - Adaptive Lesson generates from ALL errors across all lessons.
 *   - Review (SRS) replays a queue spanning all lessons on a schedule.
 *   - Error Replay: the EXACT same exercises the learner just failed,
 *     immediately, one more time.
 *
 * "Failed" = an exercise step whose stored result scored fewer correct
 * elements than its total (``correct < total``). Theory steps and
 * exercises the learner aced are skipped. Pure + storage-agnostic so
 * it tests trivially and runs the same in API + Dexie modes.
 */

import type {
    ContentLesson,
    ContentLessonCard,
    ContentLessonExercise,
    ElementError,
    LessonProgress,
} from "../../storage/types";
import {MATCHING_MIN_PAIRS} from "../exercises/authoring/exercise-edit";
import {matchesExerciseIdentity} from "../srs/exercise-identity";

/** Router-state payload handed to the ErrorReplayLesson page — the
 *  exact failed exercises (+ the lesson's cards for code-mode +
 *  per-element context, + the title for the header). Lives here (the
 *  replay lib) so every consumer — the summary's mistakes section and
 *  the replay page — shares one definition. */
export interface ErrorReplayPayload {
    exercises: ContentLessonExercise[];
    cards: ContentLessonCard[];
    lessonTitle: string;
}

/** The failed exercises of a lesson run, in lesson order. Empty when
 *  there's no progress, the lesson was perfect, or only theory steps
 *  were touched. */
export function collectFailedExercises(
    lesson: ContentLesson,
    progress: LessonProgress | null,
): ContentLessonExercise[] {
    if (!progress) return [];
    const failed: ContentLessonExercise[] = [];
    for (const step of lesson.steps) {
        if (step.type !== "exercise" || !step.exercise) continue;
        const result = progress.step_results[step.id];
        // Only steps that were attempted AND scored below full.
        if (result && result.total > 0 && result.correct < result.total) {
            failed.push(step.exercise);
        }
    }
    return failed;
}

/** Count of failed exercises — drives the Next-Step error-replay
 *  card's availability + "{count} exercises again" label. */
export function failedExerciseCount(
    lesson: ContentLesson,
    progress: LessonProgress | null,
): number {
    return collectFailedExercises(lesson, progress).length;
}

/**
 * Of the originally-failed exercises, the ones STILL unresolved in the
 * live SRS error state — what the summary's "Fehler wiederholen" CTA
 * should offer, since the static ``step_results`` never change after a
 * replay (#1305), only ``elementErrors`` do.
 *
 * An exercise is still "open" while any of its ``ElementError`` rows was
 * last answered wrong (``correct_streak === 0``) and is not ``mastered``;
 * a correct error-replay attempt advances the streak, so the exercise
 * drops out. Conservative on missing signal: an exercise with no element
 * rows yet (e.g. before its first recorded attempt) stays open rather
 * than being hidden as resolved.
 *
 * @param failed - the originally-failed exercises (from ``step_results``).
 * @param sessionErrors - live ``ElementError`` rows for this lesson.
 */
export function openFailedExercises(
    failed: readonly ContentLessonExercise[],
    sessionErrors: readonly ElementError[],
): ContentLessonExercise[] {
    return failed.filter((exercise) => {
        // #2130: rows may be keyed by the authored slug (pre-switch) or the
        // stable_id (post-switch); the exercise answers to either.
        const rows = sessionErrors.filter((row) =>
            matchesExerciseIdentity(exercise, row.exercise_id),
        );
        if (rows.length === 0) return true; // no live signal → keep
        return rows.some(
            (row) => !row.mastered && (row.correct_streak ?? 0) === 0,
        );
    });
}

/** An element is "still wrong" when its SRS row is unmastered and its
 *  correct-streak sits at zero — the same predicate the replay CTA uses. */
function isElementStillWrong(row: ElementError): boolean {
    return !row.mastered && (row.correct_streak ?? 0) === 0;
}

/** The set of still-wrong ``element_key``s for one exercise, drawn from the
 *  live SRS error rows. For matching, ``element_key === pair.left``. */
function wrongElementKeys(
    exercise: ContentLessonExercise,
    sessionErrors: readonly ElementError[],
): Set<string> {
    const keys = new Set<string>();
    for (const row of sessionErrors) {
        if (
            matchesExerciseIdentity(exercise, row.exercise_id) &&
            isElementStillWrong(row)
        ) {
            keys.add(row.element_key);
        }
    }
    return keys;
}

/** Whether the error-replay round replays only the wrong elements
 *  (default) or the whole failed exercises unchanged (#1874). */
export interface ReplayScope {
    /** ``true`` = replay only the wrong elements; ``false`` = whole set. */
    errorsOnly: boolean;
}

const DEFAULT_REPLAY_SCOPE: ReplayScope = {errorsOnly: true};

/**
 * Narrow the error-replay payload to what the learner actually got wrong
 * (#1874).
 *
 * Matching exercises are the reason this exists: a failed matching step
 * carries its FULL ``pairs`` list, so a mixed-result exercise would replay
 * every pair, including the already-correct ones. Here each matching
 * exercise is trimmed to its wrong pairs (identified via the live
 * ``ElementError`` rows, where ``element_key === pair.left``).
 *
 * Mechanical fill: a matching exercise with a single wrong pair is not a
 * puzzle (nothing to choose between), so when fewer than
 * {@link MATCHING_MIN_PAIRS} wrong pairs remain, already-correct pairs are
 * appended as pure distractors — in authored order, deterministic — until
 * the minimum is reached. They exist only for playability.
 *
 * Non-matching exercises pass through unchanged: their failure granularity
 * already IS the whole exercise (free-text = one prompt; a cloze replays
 * its blanks as authored). When ``scope.errorsOnly`` is false the learner
 * asked for the whole set, so everything passes through unchanged.
 *
 * Conservative on missing signal: a matching exercise with no wrong-key
 * rows yet, or where every pair is wrong, is kept whole rather than
 * emptied.
 *
 * @param exercises - the (open) failed exercises to replay.
 * @param sessionErrors - live ``ElementError`` rows for this lesson.
 * @param scope - replay scope; defaults to errors-only.
 */
export function narrowReplayExercises(
    exercises: readonly ContentLessonExercise[],
    sessionErrors: readonly ElementError[],
    scope: ReplayScope = DEFAULT_REPLAY_SCOPE,
): ContentLessonExercise[] {
    if (!scope.errorsOnly) return [...exercises];
    return exercises.map((exercise) => {
        if (exercise.type !== "matching") return exercise;
        const pairs = exercise.pairs ?? [];
        if (pairs.length <= MATCHING_MIN_PAIRS) return exercise;

        const wrongKeys = wrongElementKeys(exercise, sessionErrors);
        if (wrongKeys.size === 0) return exercise; // no signal → keep whole

        const wrong = pairs.filter((pair) => wrongKeys.has(pair.left));
        // Nothing to trim (all wrong) or nothing identified → keep whole.
        if (wrong.length === 0 || wrong.length === pairs.length) return exercise;

        const fillersNeeded = Math.max(0, MATCHING_MIN_PAIRS - wrong.length);
        const distractors = pairs
            .filter((pair) => !wrongKeys.has(pair.left))
            .slice(0, fillersNeeded);
        return {...exercise, pairs: [...wrong, ...distractors]};
    });
}
