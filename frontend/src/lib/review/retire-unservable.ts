/**
 * Retire the due rows a review session found it cannot build a question for
 * (#3952), so every due count outside the session drops them too.
 *
 * The impure half of {@link classifyUnservable}: it reads the set's lesson
 * listing when a lesson failed to load, and writes through the storage
 * facade (both modes). Best effort: a failure here never disturbs the
 * session, the rows are simply found again next time.
 *
 * A row the #2161 recovery can still re-key is left alone although its key
 * is gone: retiring it would take the learner's restore away (#3958).
 */

import {getStorage} from "../../storage";
import {isRecoverableRow} from "../content/recovery/jkz-recovery-service";
import type {ContentLesson, UnservableReason} from "../../storage/types";
import {notifyReviewsChanged} from "./reviewsChanged";
import {classifyUnservable, type ElementRowRef} from "./unservable";

const REASONS: readonly UnservableReason[] = [
    "exercise_missing",
    "lesson_missing",
    "element_missing",
];

/** The set's lesson listing, or ``null`` when it cannot be read. */
async function listedLessons(source: string, setId: string): Promise<string[] | null> {
    try {
        return (await getStorage().contentLoader.listLessons(source, setId)).lessons;
    } catch {
        return null;
    }
}

/**
 * Retire the rows of ``queue`` whose exercise, lesson or element is provably
 * gone.
 *
 * @param queue every due row of the set, as the storage returned it.
 * @param loadedLessons the lessons the session could load.
 * @example
 * void retireUnservableRows(userId, set.source, setId, fetchedQueue, lessonMap);
 */
export async function retireUnservableRows(
    userId: string,
    source: string,
    setId: string,
    queue: readonly ElementRowRef[],
    loadedLessons: ReadonlyMap<string, ContentLesson>,
): Promise<void> {
    try {
        const someLessonDidNotLoad = queue.some((item) => !loadedLessons.has(item.lesson_id));
        const listing = someLessonDidNotLoad ? await listedLessons(source, setId) : null;
        const rows = classifyUnservable(queue, loadedLessons, listing, isRecoverableRow);
        let asked = false;
        for (const reason of REASONS) {
            if (rows[reason].length === 0) continue;
            asked = true;
            await getStorage().elementErrors.retireUnservable(userId, rows[reason], reason);
        }
        if (asked) notifyReviewsChanged();
    } catch (err) {
        console.warn("review: could not retire unservable rows", err);
    }
}

/** Load the lessons the rows point at; a lesson that does not load is left out. */
async function loadReferencedLessons(
    source: string,
    setId: string,
    rows: readonly ElementRowRef[],
): Promise<Map<string, ContentLesson>> {
    const lessons = new Map<string, ContentLesson>();
    for (const lessonId of new Set(rows.map((row) => row.lesson_id))) {
        try {
            lessons.set(lessonId, await getStorage().contentLoader.getLesson(source, setId, lessonId));
        } catch {
            // Judged by the listing instead (see classifyUnservable).
        }
    }
    return lessons;
}

/**
 * Retire a set's rows that its installed version can no longer serve.
 *
 * Called right after a set update the learner confirmed although the guard
 * reported lost progress (#2128): the rows the update orphans are retired at
 * the moment the app knowingly orphans them, with the reason, instead of
 * staying due until a review session trips over them. Mastered rows are left
 * alone: they are out of scheduling already. Never throws.
 *
 * @example
 * await retireUnservableInSet(userId, entry.source, entry.id);
 */
export async function retireUnservableInSet(
    userId: string,
    source: string,
    setId: string,
): Promise<void> {
    try {
        const rows = await getStorage().elementErrors.list(userId, {
            setId,
            includeMastered: false,
        });
        if (rows.length === 0) return;
        const lessons = await loadReferencedLessons(source, setId, rows);
        await retireUnservableRows(userId, source, setId, rows, lessons);
    } catch (err) {
        console.warn("review: could not check the set for unservable rows", err);
    }
}
