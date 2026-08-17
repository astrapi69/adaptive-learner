/**
 * plan-set-update — build the proposed re-keying for ONE set, from live data
 * (#2308, Weg C of #2301; AUTH-05 added the exercise-level half).
 *
 * Deliberately NOT part of ``assessSetUpdate``. The assessment runs on both
 * paths, including the nightly sync, and the nightly sync must never apply a
 * mapping: an inference applied while nobody is watching is the silent state
 * this whole line of work exists to remove, only with the opposite sign. So
 * the plan is not merely unapplied there - it is not even computed there. The
 * manual dialog is the only caller.
 *
 * Reads the CACHED lessons (what the learner's rows were recorded against)
 * through the mode-agnostic storage facade, so it behaves identically in API
 * and Dexie mode.
 *
 * AUTH-05: two remap dimensions, planned and applied in sequence, never
 * combined into one pass. ``exercise_id`` is resolved FIRST - an exercise
 * whose authored slug was renumbered gets a certain/uncertain verdict from
 * {@link planExerciseIdRemaps}, exactly like ``planElementKeyRemaps`` does one
 * level down. Only THEN does the element-key plan run, against identities
 * whose ``exercise_id`` has already been substituted with its resolved
 * value where the exercise plan was certain - ``planElementKeyRemaps``'s own
 * ``classify()`` hard-assumes the exercise already resolves (refuses
 * ``exercise_gone`` otherwise), so it must see the post-exercise-remap
 * identity to have anything to work with. The caller applies in the SAME
 * order (exercise remap written to storage first, element-key remap
 * second) - see ``useContentSetActions.ts``'s ``confirmUpdate``.
 */

import {getStorage} from "../../../storage";
import type {ContentLesson} from "../../../storage/types";
import {planExerciseIdRemaps, type ExerciseRemapPlan} from "./exercise-remap-plan";
import {planElementKeyRemaps, type RemapPlan} from "./remap-plan";
import type {PeekExercise, PeekLesson, SrsIdentity, UpdateImpact} from "./update-impact";

/** The proposed re-keying for one set, both dimensions. */
export interface SetUpdatePlan {
    exercise: ExerciseRemapPlan;
    element: RemapPlan;
}

const EMPTY_PLAN: SetUpdatePlan = {
    exercise: {certain: [], uncertain: []},
    element: {certain: [], uncertain: []},
};

/** Unique (lesson_id, exercise_id) pairs a set of SRS identities touches -
 *  the exercise-level plan works on exercises, not on the (possibly several)
 *  element_keys recorded under each one. */
function uniqueExerciseIdentities(
    identities: readonly SrsIdentity[],
): {lesson_id: string; exercise_id: string}[] {
    const seen = new Set<string>();
    const result: {lesson_id: string; exercise_id: string}[] = [];
    for (const identity of identities) {
        const key = `${identity.lesson_id} ${identity.exercise_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({lesson_id: identity.lesson_id, exercise_id: identity.exercise_id});
    }
    return result;
}

/** Substitute each identity's ``exercise_id`` with its resolved value where
 *  the exercise plan was certain, so the element-key plan classifies against
 *  the exercise the row will ACTUALLY live under once the exercise remap is
 *  applied. An identity the exercise plan did not touch (already resolved,
 *  or genuinely gone) passes through unchanged. */
function resolveExerciseIds(
    identities: readonly SrsIdentity[],
    exerciseRemaps: readonly {lesson_id: string; old: string; new: string}[],
): SrsIdentity[] {
    const resolved = new Map(
        exerciseRemaps.map((r) => [`${r.lesson_id} ${r.old}`, r.new]),
    );
    return identities.map((identity) => {
        const key = `${identity.lesson_id} ${identity.exercise_id}`;
        const newExerciseId = resolved.get(key);
        return newExerciseId === undefined
            ? identity
            : {...identity, exercise_id: newExerciseId};
    });
}

/**
 * Relabel the CACHED lessons' exercise ids to their resolved value, in step
 * with {@link resolveExerciseIds}. The element-key plan's ``classify()``
 * looks the SAME ``exercise_id`` up on both the cached and the incoming
 * side - resolving only the identity would make it search the OLD (cached)
 * lesson for the NEW id and find nothing. Relabeling the cached exercise's
 * ``id`` (never its content) keeps both lookups pointed at the same
 * exercise, under the id it will carry once the exercise remap is applied.
 */
function relabelCachedExercises(
    cached: readonly PeekLesson[],
    exerciseRemaps: readonly {lesson_id: string; old: string; new: string}[],
): PeekLesson[] {
    const byLesson = new Map<string, Map<string, string>>();
    for (const remap of exerciseRemaps) {
        if (!byLesson.has(remap.lesson_id)) byLesson.set(remap.lesson_id, new Map());
        byLesson.get(remap.lesson_id)?.set(remap.old, remap.new);
    }
    return cached.map((lesson) => {
        const renames = byLesson.get(lesson.filename);
        if (!renames) return lesson;
        return {
            filename: lesson.filename,
            exercises: lesson.exercises.map((exercise) => {
                const newId = exercise.id ? renames.get(exercise.id) : undefined;
                return newId === undefined ? exercise : {...exercise, id: newId};
            }),
        };
    });
}

/**
 * The filename a lesson is addressed by wherever a learner row or a content
 * read is keyed: the BARE ``{lesson.id}.json``.
 *
 * Not the ``lessons/``-prefixed cache path. ``listLessons`` strips that prefix
 * from its cache rows and ``getLesson`` re-adds it, so every value that
 * travels between the two - the lesson route's ``filename``, the attempt
 * recorder's ``lessonId``, and therefore ``ElementError.lesson_id`` - is the
 * bare form. #2657 is what one module assuming the prefixed form cost: its
 * row filter matched nothing and the fix shipped inert.
 */
export function lessonFileName(lessonId: string): string {
    return `${lessonId}.json`;
}

/** Pull the exercises out of a cached lesson, mirroring the peek's shape so
 *  both sides of the comparison are read the same way. Shared with the
 *  #2130 stable-id migration, which reads cached lessons the same way. */
export function cachedLessonToPeek(filename: string, lesson: ContentLesson): PeekLesson {
    const exercises: PeekExercise[] = [];
    for (const step of lesson.steps ?? []) {
        const exercise = step.exercise;
        if (exercise?.id) exercises.push(exercise);
    }
    return {filename, exercises};
}

/**
 * Plan BOTH remap dimensions for one set from two lesson versions already in
 * hand - the pure half of {@link planSetUpdate}, with no storage read of its
 * own.
 *
 * Extracted (#2592) because all three entry points that overwrite a set's
 * content need the identical two-dimension sequence and differ only in where
 * the two versions come from: the repo-download path peeks them over HTTP
 * (below), the local edit path holds them in the wizard's own state
 * (``edit-remap.ts``), and the import-overwrite path reads the saved set and
 * parses the incoming file (``import-remap.ts``). The sequence itself is NOT
 * a detail any caller may re-derive: ``exercise_id`` must resolve first,
 * because ``planElementKeyRemaps``'s ``classify()`` hard-assumes the exercise
 * already resolves - see this module's header.
 */
export function planRemapsForVersions(
    identities: readonly SrsIdentity[],
    cached: readonly PeekLesson[],
    incoming: readonly PeekLesson[],
    setId: string,
): SetUpdatePlan {
    const exercise = planExerciseIdRemaps(
        uniqueExerciseIdentities(identities),
        cached,
        incoming,
        setId,
    );
    const resolvedIdentities = resolveExerciseIds(identities, exercise.certain);
    const relabeledCached = relabelCachedExercises(cached, exercise.certain);
    const element = planElementKeyRemaps(
        resolvedIdentities,
        relabeledCached,
        incoming,
        setId,
    );

    return {exercise, element};
}

/**
 * Propose a mapping for the rows this update would orphan.
 *
 * Only the lessons the learner actually holds rows in are read - a set with
 * one affected lesson costs one lesson read, not the whole set. A lesson that
 * cannot be read (evicted cache, transient failure) is simply absent from the
 * cached side, and every row in it comes back as uncertain rather than being
 * mapped from a half-known state.
 *
 * ``impact.lostCards[].lesson_id`` is passed straight to ``getLesson`` as the
 * filename: an ``ElementError.lesson_id`` IS the bare lesson filename that
 * ``listLessons`` returns (the ``lessons/`` prefix is stripped there and
 * re-added by ``getLesson``). #2657 is what assuming otherwise costs.
 */
export async function planSetUpdate(
    source: string,
    setId: string,
    impact: UpdateImpact,
    incomingLessons: readonly PeekLesson[],
): Promise<SetUpdatePlan> {
    if (impact.lostCards.length === 0) return EMPTY_PLAN;

    const storage = getStorage();
    const filenames = [...new Set(impact.lostCards.map((card) => card.lesson_id))];
    const cached: PeekLesson[] = [];
    for (const filename of filenames) {
        try {
            const lesson = await storage.contentLoader.getLesson(source, setId, filename);
            cached.push(cachedLessonToPeek(filename, lesson));
        } catch {
            // Unreadable -> the rows in it stay uncertain. Never inferred from
            // a version we could not see.
        }
    }

    return planRemapsForVersions(impact.lostCards, cached, incomingLessons, setId);
}
