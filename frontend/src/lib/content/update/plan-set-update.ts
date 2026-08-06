/**
 * plan-set-update — build the proposed re-keying for ONE set, from live data
 * (#2308, Weg C of #2301).
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
 */

import {getStorage} from "../../../storage";
import type {ContentLesson} from "../../../storage/types";
import {planElementKeyRemaps, type RemapPlan} from "./remap-plan";
import type {PeekExercise, PeekLesson, UpdateImpact} from "./update-impact";

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
 * Propose a mapping for the rows this update would orphan.
 *
 * Only the lessons the learner actually holds rows in are read - a set with
 * one affected lesson costs one lesson read, not the whole set. A lesson that
 * cannot be read (evicted cache, transient failure) is simply absent from the
 * cached side, and every row in it comes back as uncertain rather than being
 * mapped from a half-known state.
 */
export async function planSetUpdate(
    source: string,
    setId: string,
    impact: UpdateImpact,
    incomingLessons: readonly PeekLesson[],
): Promise<RemapPlan> {
    if (impact.lostCards.length === 0) return {certain: [], uncertain: []};

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

    return planElementKeyRemaps(impact.lostCards, cached, incomingLessons, setId);
}
