/**
 * #2592 — carry per-element SRS/error history across an IMPORT-OVERWRITE.
 *
 * ``ImportLessonModal.overwrite()`` is the third entry point that replaces a
 * set's content in place, and it was the last one still doing it blind. On a
 * set-id collision the learner confirms "Overwrite" and ``saveUserSet``
 * replaces the content directly — no peek-old-vs-new, no remap step. A
 * corrected answer text in the imported file (or a renamed exercise id)
 * therefore orphaned the rows recorded under the old identity SILENTLY: no
 * toast, no hint, the progress on that exercise simply gone. The
 * "Import as copy" branch is unaffected (fresh set id, no prior progress).
 *
 * Both sibling paths already run the certain-only remap machinery this reuses:
 * the repo-download-update path (#2308/#2161, exercise dimension #2569) and
 * the local edit-save path (#2519). Same class, third entry point — kept as a
 * sibling facet of that chain rather than a fresh one-off, per
 * ``lessons/content-storage.md``'s "recurrences reopen the class".
 *
 * Sequencing, and why it is not negotiable:
 *
 *  1. PLAN BEFORE THE SAVE. The plan needs the version the learner's rows were
 *     recorded against, and ``saveUserSet`` destroys it. Once the content is
 *     replaced there is nothing left to compare, so a post-save peek can only
 *     ever report "cannot map".
 *  2. APPLY AFTER THE SAVE. If the content write fails, the old content and
 *     its identities are still correct and must stay untouched — re-keying
 *     rows onto identities no stored version has would be a worse state than
 *     today's.
 *  3. Within the apply, ``exercise_id`` first, then ``element_key``: the
 *     element plan's proposed ids already assume the exercise remap landed
 *     (see ``plan-set-update.ts``).
 *
 * Mode-agnostic throughout: every read and write goes through
 * ``getStorage()``, and both ``remapExerciseIds`` and ``remapKeys`` exist in
 * the API and Dexie implementations. Per-mode proof lives in
 * ``import-remap.modes.test.ts`` (#2053).
 */

import {getStorage} from "../../../storage";
import {notify} from "../../../utils/notify";
import {readLearnerState} from "../../learning/learnerState";
import {
    cachedLessonToPeek,
    lessonFileName,
    planRemapsForVersions,
    type SetUpdatePlan,
} from "../update/plan-set-update";
import type {PeekLesson, SrsIdentity} from "../update/update-impact";
import type {ContentLesson} from "../../../storage/types";
import {USER_GENERATED_SOURCE} from "../../../storage/types";

type Translate = (key: string, fallback?: string) => string;

const EMPTY_PLAN: SetUpdatePlan = {
    exercise: {certain: [], uncertain: []},
    element: {certain: [], uncertain: []},
};

export interface ImportOverwriteCarryOverResult {
    /** Rows successfully carried over onto their new identity. */
    applied: number;
    /** Rows the plan could not confidently resolve — left under their old
     *  identity, and REPORTED, never silently dropped (#2592's whole point). */
    uncertain: number;
}

/**
 * The step that finishes a carry-over once the overwrite itself has landed.
 * Resolved by {@link prepareOverwriteCarryOver} before the save; called after.
 */
export type OverwriteCarryOver = () => Promise<void>;

/**
 * Read the incoming (parsed) lessons the way both plan dimensions read a
 * lesson version, naming each one by the filename its rows are keyed on.
 */
export function incomingLessonsToPeek(
    lessons: readonly ContentLesson[],
): PeekLesson[] {
    return lessons.map((lesson) =>
        cachedLessonToPeek(lessonFileName(lesson.id), lesson),
    );
}

/**
 * Plan what overwriting the SAVED set with ``incomingLessons`` would orphan.
 *
 * Must be called BEFORE ``saveUserSet`` — it reads the stored version that the
 * save is about to replace. Only the lessons the learner actually holds rows
 * in are read (a three-lesson set with rows in one costs one lesson read), and
 * a lesson that cannot be read is simply absent from the cached side, so its
 * rows come back uncertain instead of being mapped from a half-known state.
 *
 * ``includeMastered`` states an intent rather than changing behaviour - it is
 * already the default in both modes - so that a future default flip cannot
 * quietly stop carrying the rows that hold the most history.
 */
export async function planImportOverwrite(
    userId: string,
    setId: string,
    incomingLessons: readonly ContentLesson[],
): Promise<SetUpdatePlan> {
    const storage = getStorage();
    const rows = await storage.elementErrors.list(userId, {
        setId,
        includeMastered: true,
    });
    const identities: SrsIdentity[] = rows.map((row) => ({
        lesson_id: row.lesson_id,
        exercise_id: row.exercise_id,
        element_key: row.element_key,
    }));
    if (identities.length === 0) return EMPTY_PLAN;

    const filenames = [...new Set(identities.map((identity) => identity.lesson_id))];
    const cached: PeekLesson[] = [];
    for (const filename of filenames) {
        try {
            const lesson = await storage.contentLoader.getLesson(
                USER_GENERATED_SOURCE,
                setId,
                filename,
            );
            cached.push(cachedLessonToPeek(filename, lesson));
        } catch {
            // Unreadable -> its rows stay uncertain. Never inferred from a
            // version we could not see.
        }
    }

    return planRemapsForVersions(
        identities,
        cached,
        incomingLessonsToPeek(incomingLessons),
        setId,
    );
}

/**
 * Apply the certain half of a plan, exercise dimension first.
 *
 * The uncertain half is never written — it is counted so the caller can say so.
 */
export async function applyImportOverwritePlan(
    userId: string,
    plan: SetUpdatePlan,
): Promise<ImportOverwriteCarryOverResult> {
    const uncertain = plan.exercise.uncertain.length + plan.element.uncertain.length;
    const storage = getStorage();
    let applied = 0;
    if (plan.exercise.certain.length > 0) {
        const result = await storage.elementErrors.remapExerciseIds(
            userId,
            plan.exercise.certain,
        );
        applied += result.applied;
    }
    if (plan.element.certain.length > 0) {
        const result = await storage.elementErrors.remapKeys(userId, plan.element.certain);
        applied += result.applied;
    }
    return {applied, uncertain};
}

/**
 * ``ImportLessonModal.overwrite()``'s call site: plan the carry-over from the
 * still-stored version and return the step that applies it once the overwrite
 * has succeeded.
 *
 * Best-effort in both halves, because the learner's import must never fail
 * because their progress could not be carried: a planning failure resolves to
 * a step that REPORTS the failure (the shared ``carry_over_failed``
 * vocabulary) rather than throwing into the import's own error path, where it
 * would read as "the import failed" and send the learner looking for a
 * problem with their file. A set with no rows, or nobody signed in, resolves
 * to a silent no-op — there is nothing to say.
 */
export async function prepareOverwriteCarryOver(
    setId: string,
    incomingLessons: readonly ContentLesson[],
    t: Translate,
): Promise<OverwriteCarryOver> {
    const userId = readLearnerState().userId;
    if (!userId) return async () => {};

    let plan: SetUpdatePlan;
    try {
        plan = await planImportOverwrite(userId, setId, incomingLessons);
    } catch {
        return async () => {
            notify.error(
                t(
                    "content.update_guard.carry_over_failed",
                    "The update was applied, but the progress could not be carried over.",
                ),
            );
        };
    }

    const nothingToDo =
        plan.exercise.certain.length === 0 &&
        plan.element.certain.length === 0 &&
        plan.exercise.uncertain.length === 0 &&
        plan.element.uncertain.length === 0;
    if (nothingToDo) return async () => {};

    return async () => {
        try {
            const {applied, uncertain} = await applyImportOverwritePlan(userId, plan);
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
    };
}
