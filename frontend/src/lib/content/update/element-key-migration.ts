/**
 * element-key-migration — re-key a set's learner rows from an element's text
 * to the element's version-stable ``stable_id`` (#3960). The element-level
 * twin of the #2130 exercise migration (stable-id-migration.ts).
 *
 * Since engine#91 a matching pair, a cloze blank and a multiple-choice option
 * can carry their own ``stable_id``, and an answer is recorded under it. A row
 * still keyed by the element's text (recorded before the id was minted, or
 * restored from a backup written then) is asked in every review and never
 * reached by the answer.
 *
 * The mapping is not an inference across two versions: one installed
 * exercise names, for one element, both its text and its ``stable_id``. So it
 * is applied without asking, like #2130. It is refused where the text does
 * not name exactly one element: the text occurs twice in the exercise, or the
 * text or the id is also another element's key.
 *
 * A multiple choice has one collapsed key over its correct options, so a row
 * can also sit on a mix of texts and ids (the options were minted one after
 * the other). Those mixes are former keys too (#3962); elementFormerKeysOf
 * names them.
 *
 * ``remapKeys`` never collapses two rows. A text-keyed row whose ``stable_id``
 * row exists already is a second, stale history of the same element; it is
 * retired as ``superseded`` unless it is mastered (it keeps its place in the
 * mastery figures) or retired already.
 *
 * Idempotent: after a run no active row sits on a text key that has a
 * ``stable_id``, so a re-run finds nothing to write.
 *
 * @example
 * ```ts
 * const res = await migrateSetElementKeys(userId, "owner/repo", "es-a1");
 * // res = {applied: 3, skipped: 1, superseded: 1}
 * ```
 */

import {getStorage} from "../../../storage";
import type {ElementError, ElementKeyRemap} from "../../../storage/types";
import {notifyReviewsChanged} from "../../review/reviewsChanged";
import {elementFormerKeysOf, elementIdentityKeysOf} from "../../srs/element-identity";
import {cachedLessonToPeek} from "./plan-set-update";
import type {PeekExercise, PeekLesson} from "./update-impact";

/** What one migration run did. */
export interface ElementKeyMigrationResult {
    applied: number;
    skipped: number;
    /** Stale text-keyed rows retired because the stable_id row exists. */
    superseded: number;
}

const NOTHING: ElementKeyMigrationResult = {applied: 0, skipped: 0, superseded: 0};

/** The ids a row of ``exercise`` may carry as ``exercise_id`` (#2130). */
function exerciseIdsOf(exercise: PeekExercise): string[] {
    const ids = [exercise.stable_id, exercise.id].filter(
        (id): id is string => typeof id === "string" && id !== "",
    );
    return [...new Set(ids)];
}

/** The former key -> current key pairs one exercise declares without
 *  ambiguity (a former key is the element's text, or for a multiple choice
 *  one of its text-or-id mixes, #3962). */
function exerciseKeyPairs(exercise: PeekExercise): {old: string; new: string}[] {
    const formerKeys = elementFormerKeysOf(exercise);
    const identities = elementIdentityKeysOf(exercise);
    if (formerKeys === null || identities === null) return [];
    const allFormer = formerKeys.flat();
    const pairs: {old: string; new: string}[] = [];
    identities.forEach((identity, index) => {
        if (!identity) return;
        const identityNamesOneElement =
            identities.filter((other) => other === identity).length === 1 &&
            !allFormer.includes(identity);
        if (!identityNamesOneElement) return;
        for (const former of formerKeys[index] ?? []) {
            const formerNamesOneElement =
                allFormer.filter((other) => other === former).length === 1 &&
                !identities.includes(former);
            if (formerNamesOneElement) pairs.push({old: former, new: identity});
        }
    });
    return pairs;
}

/**
 * Derive the text -> stable_id remaps one set's lessons declare.
 *
 * A lesson without element-level stable_ids contributes nothing, so the
 * caller needs no feature flag.
 */
export function planElementKeyMigration(
    setId: string,
    lessons: readonly PeekLesson[],
): ElementKeyRemap[] {
    const remaps: ElementKeyRemap[] = [];
    for (const lesson of lessons) {
        for (const exercise of lesson.exercises) {
            const pairs = exerciseKeyPairs(exercise);
            for (const exerciseId of exerciseIdsOf(exercise)) {
                for (const pair of pairs) {
                    remaps.push({
                        set_id: setId,
                        lesson_id: lesson.filename,
                        exercise_id: exerciseId,
                        ...pair,
                    });
                }
            }
        }
    }
    return remaps;
}

function sitsOn(row: ElementError, remap: ElementKeyRemap): boolean {
    return (
        row.lesson_id === remap.lesson_id &&
        row.exercise_id === remap.exercise_id &&
        row.element_key === remap.old
    );
}

/** Load the cached lessons the rows point at; an unreadable one is left out,
 *  so its rows keep their key and a later run retries. */
async function cachedLessonsOf(
    source: string,
    setId: string,
    rows: readonly ElementError[],
): Promise<PeekLesson[]> {
    const lessons: PeekLesson[] = [];
    for (const filename of new Set(rows.map((row) => row.lesson_id))) {
        try {
            const lesson = await getStorage().contentLoader.getLesson(source, setId, filename);
            lessons.push(cachedLessonToPeek(filename, lesson));
        } catch {
            // Evicted cache or a transient failure.
        }
    }
    return lessons;
}

/** Retire the active rows the remap left on a text key: their stable_id row
 *  exists already. Returns how many were retired. */
async function retireSuperseded(
    userId: string,
    setId: string,
    remaps: readonly ElementKeyRemap[],
): Promise<number> {
    const storage = getStorage();
    const rows = await storage.elementErrors.list(userId, {
        setId,
        includeMastered: false,
    });
    const stale = rows
        .filter((row) => !row.retired_at && remaps.some((remap) => sitsOn(row, remap)))
        .map((row) => row.id);
    if (stale.length === 0) return 0;
    return (await storage.elementErrors.retireUnservable(userId, stale, "superseded")).retired;
}

/**
 * Re-key the learner's rows of ONE installed set from element text onto
 * ``stable_id``. Reads only the cached lessons the learner holds rows in.
 */
export async function migrateSetElementKeys(
    userId: string,
    source: string,
    setId: string,
): Promise<ElementKeyMigrationResult> {
    const storage = getStorage();
    const rows = await storage.elementErrors.list(userId, {
        setId,
        includeMastered: true,
        includeRetired: true,
    });
    if (rows.length === 0) return NOTHING;

    const planned = planElementKeyMigration(setId, await cachedLessonsOf(source, setId, rows));
    const remaps = planned.filter((remap) => rows.some((row) => sitsOn(row, remap)));
    if (remaps.length === 0) return NOTHING;

    const {applied, skipped} = await storage.elementErrors.remapKeys(userId, remaps);
    const superseded = skipped > 0 ? await retireSuperseded(userId, setId, remaps) : 0;
    if (applied > 0 || superseded > 0) notifyReviewsChanged();
    return {applied, skipped, superseded};
}
