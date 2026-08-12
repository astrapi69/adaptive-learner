/**
 * #2519 — carry per-element SRS/error history across a LOCAL edit-save.
 *
 * ``saveUserSet`` (the local edit-save path, ``CreateLesson.saveLocally``)
 * overwrites a lesson's content directly, with no peek-old-vs-new and no
 * remap step - unlike the repo-download-update path, which already runs
 * ``planElementKeyRemaps`` (#2308/#2161) before applying a breaking update.
 * A locally edited answer text (e.g. a ``free_text.accept[0]`` typo fix)
 * silently orphaned that element's review-card row, because its
 * ``element_key`` is derived fresh from content on every read and nothing
 * bridged the old key to the new one on a local save.
 *
 * This reuses the SAME remap-plan machinery the download path already
 * trusts (``planElementKeyRemaps``, position-based, certain-only - see
 * ``remap-plan.ts``), pointed at the edit wizard's own before/after
 * ``ContentLesson`` state instead of a downloaded snapshot. Call this AFTER
 * ``saveUserSet`` succeeds, never before - if the content save fails, the
 * old content and its element_keys are still correct and must stay
 * untouched.
 */

import {getStorage} from "../../../../storage";
import {cachedLessonToPeek} from "../../update/plan-set-update";
import {planElementKeyRemaps} from "../../update/remap-plan";
import type {SrsIdentity} from "../../update/update-impact";
import type {ContentLesson} from "../../../../storage/types";

/** The ``lessons/{id}.json`` path ``ElementError.lesson_id`` is stored under
 *  - ``lesson.id`` is the bare id; every read/write path keys on the
 *  filename (see ``useEndlessLesson.ts`` / ``useShuffleLesson.ts``). */
export function lessonFilePath(lessonId: string): string {
    return `lessons/${lessonId}.json`;
}

export interface RemapOrphanedElementKeysResult {
    /** Review-card rows successfully carried over to their new element_key. */
    applied: number;
    /** Rows the plan could not confidently resolve (reordered / shifted /
     *  ambiguous) - left untouched under their old key, so the caller should
     *  tell the user rather than stay silent (#2519's "minimum" fallback). */
    uncertain: number;
}

/**
 * Carry over review-card rows orphaned by a local edit of ONE lesson.
 * Certain remaps (same position, unambiguous - see ``classify()`` in
 * ``remap-plan.ts``) are applied via ``elementErrors.remapKeys`` (works in
 * both storage modes); anything the plan cannot confidently resolve is
 * reported via ``uncertain``, never silently dropped.
 *
 * A no-op (returns ``{applied: 0, uncertain: 0}`` with no storage write)
 * when the lesson has no existing review-card rows to carry.
 */
export async function remapOrphanedElementKeys(
    userId: string,
    setId: string,
    lessonId: string,
    oldLesson: ContentLesson,
    newLesson: ContentLesson,
): Promise<RemapOrphanedElementKeysResult> {
    const storage = getStorage();
    const filePath = lessonFilePath(lessonId);
    const rows = await storage.elementErrors.list(userId, {setId});
    const identities: SrsIdentity[] = rows
        .filter((row) => row.lesson_id === filePath)
        .map((row) => ({
            lesson_id: row.lesson_id,
            exercise_id: row.exercise_id,
            element_key: row.element_key,
        }));
    if (identities.length === 0) return {applied: 0, uncertain: 0};

    const cached = [cachedLessonToPeek(filePath, oldLesson)];
    const incoming = [cachedLessonToPeek(filePath, newLesson)];
    const plan = planElementKeyRemaps(identities, cached, incoming, setId);

    if (plan.certain.length === 0) {
        return {applied: 0, uncertain: plan.uncertain.length};
    }
    const {applied} = await storage.elementErrors.remapKeys(userId, plan.certain);
    return {applied, uncertain: plan.uncertain.length};
}
