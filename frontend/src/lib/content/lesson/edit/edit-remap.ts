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
import {notify} from "../../../../utils/notify";
import {readLearnerState} from "../../../learning/learnerState";
import {cachedLessonToPeek} from "../../update/plan-set-update";
import {planElementKeyRemaps} from "../../update/remap-plan";
import type {SrsIdentity} from "../../update/update-impact";
import type {ContentLesson} from "../../../../storage/types";

type Translate = (key: string, fallback?: string) => string;

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

/**
 * ``CreateLesson.saveLocally``'s call site: run {@link remapOrphanedElementKeys}
 * for the just-saved lesson and translate the result into the same toast
 * vocabulary the repo-download-update path already uses (``carried_over`` /
 * ``carry_over_failed``, #2309's messaging). Kept out of the page component
 * so it stays under the cohesion size gate (same reasoning as
 * ``edit-session.ts``). Best-effort: the lesson content is already saved
 * regardless of this outcome, so a failure here is reported, never thrown -
 * the user's edit is never lost because progress carry-over failed. A no-op
 * (no storage read at all) when nobody is signed in.
 */
export async function carryOverReviewProgress(
    setId: string,
    lessonId: string,
    oldLesson: ContentLesson,
    newLesson: ContentLesson,
    t: Translate,
): Promise<void> {
    const userId = readLearnerState().userId;
    if (!userId) return;
    try {
        const {applied, uncertain} = await remapOrphanedElementKeys(
            userId,
            setId,
            lessonId,
            oldLesson,
            newLesson,
        );
        if (applied > 0) {
            notify.success(
                t(
                    "create_lesson.save.progress_carried_over",
                    "Carried over {count} review card(s) for the changed answer.",
                ).replace("{count}", String(applied)),
            );
        }
        if (uncertain > 0) {
            notify.info(
                t(
                    "create_lesson.save.progress_not_carried_over",
                    "{count} review card(s) could not be confidently matched to the changed answer and will be recreated on next practice.",
                ).replace("{count}", String(uncertain)),
            );
        }
    } catch {
        notify.error(
            t(
                "content.update_guard.carry_over_failed",
                "The update was applied, but the progress could not be carried over.",
            ),
        );
    }
}
