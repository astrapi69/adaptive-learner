/**
 * stable-id-migration — re-key a set's learner rows from the authored
 * exercise slug to the version-stable ``stable_id`` (#2130, EXP-045 Option A
 * + the generalized Option C mechanism).
 *
 * Since engine schema 1.9 a lesson file carries BOTH ids of an exercise: the
 * authored slug ``id`` (what pre-switch rows were recorded under) and the
 * author-owned, version-stable ``stable_id``. The mapping old -> new is
 * therefore derivable locally, per installed set, from the cached lesson
 * files alone — no shipped mapping file, no cutoff date (per-set feature
 * detection: a set without stable_ids simply yields no remaps).
 *
 * Idempotent by construction: after a run, no row is keyed by an authored
 * slug that has a stable_id, so a re-run finds nothing to move. Callers run
 * it opportunistically (before the auto-sync assessment, after a manual
 * download) rather than tracking a migration marker.
 *
 * @example
 * ```ts
 * const res = await migrateSetExerciseIds(userId, "owner/repo", "ja-a1");
 * // res = {applied: 12, skipped: 0} on first contact, {applied: 0, ...} after
 * ```
 */

import {getStorage} from "../../../storage";
import type {ExerciseIdRemap} from "../../../storage/types";
import {cachedLessonToPeek} from "./plan-set-update";
import type {PeekLesson} from "./update-impact";

/**
 * Derive the authored-slug -> stable_id remaps one set's lessons declare.
 *
 * Only exercises that carry BOTH ids and where they differ contribute; a
 * lesson without stable_ids (pre-1.9 content) contributes nothing, so the
 * caller needs no feature flag.
 */
export function planExerciseIdMigration(
    setId: string,
    lessons: readonly PeekLesson[],
): ExerciseIdRemap[] {
    const remaps: ExerciseIdRemap[] = [];
    for (const lesson of lessons) {
        for (const exercise of lesson.exercises) {
            if (
                exercise.id &&
                exercise.stable_id &&
                exercise.stable_id !== exercise.id
            ) {
                remaps.push({
                    set_id: setId,
                    lesson_id: lesson.filename,
                    old: exercise.id,
                    new: exercise.stable_id,
                });
            }
        }
    }
    return remaps;
}

/**
 * Re-key the learner's rows of ONE installed set onto ``stable_id``.
 *
 * Reads only the cached lessons the learner actually holds rows in (mirrors
 * ``planSetUpdate``'s cost shape). A lesson that cannot be read contributes
 * no remaps — its rows keep their current key and the next run retries.
 * Returns the remap counts; ``{applied: 0, skipped: 0}`` when there is
 * nothing to do.
 */
export async function migrateSetExerciseIds(
    userId: string,
    source: string,
    setId: string,
): Promise<{applied: number; skipped: number}> {
    const storage = getStorage();
    const rows = await storage.elementErrors.list(userId, {setId});
    if (rows.length === 0) return {applied: 0, skipped: 0};

    const filenames = [...new Set(rows.map((row) => row.lesson_id))];
    const cached: PeekLesson[] = [];
    for (const filename of filenames) {
        try {
            const lesson = await storage.contentLoader.getLesson(source, setId, filename);
            cached.push(cachedLessonToPeek(filename, lesson));
        } catch {
            // Unreadable (evicted cache, transient failure) -> its rows keep
            // their current key; a later run retries.
        }
    }

    const remaps = planExerciseIdMigration(setId, cached);
    if (remaps.length === 0) return {applied: 0, skipped: 0};
    return storage.elementErrors.remapExerciseIds(userId, remaps);
}
