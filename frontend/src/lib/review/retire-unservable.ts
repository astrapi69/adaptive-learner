/**
 * Retire the due rows a review session found it cannot build a question for
 * (#3952), so every due count outside the session drops them too.
 *
 * The impure half of {@link classifyUnservable}: it reads the set's lesson
 * listing when a lesson failed to load, and writes through the storage
 * facade (both modes). Best effort: a failure here never disturbs the
 * session, the rows are simply found again next time.
 */

import {getStorage} from "../../storage";
import type {ContentLesson, ReviewQueueItem, UnservableReason} from "../../storage/types";
import {notifyReviewsChanged} from "./reviewsChanged";
import {classifyUnservable} from "./unservable";

const REASONS: readonly UnservableReason[] = ["exercise_missing", "lesson_missing"];

/** The set's lesson listing, or ``null`` when it cannot be read. */
async function listedLessons(source: string, setId: string): Promise<string[] | null> {
    try {
        return (await getStorage().contentLoader.listLessons(source, setId)).lessons;
    } catch {
        return null;
    }
}

/**
 * Retire the rows of ``queue`` whose exercise or lesson is provably gone.
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
    queue: readonly ReviewQueueItem[],
    loadedLessons: ReadonlyMap<string, ContentLesson>,
): Promise<void> {
    try {
        const someLessonDidNotLoad = queue.some((item) => !loadedLessons.has(item.lesson_id));
        const listing = someLessonDidNotLoad ? await listedLessons(source, setId) : null;
        const rows = classifyUnservable(queue, loadedLessons, listing);
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
