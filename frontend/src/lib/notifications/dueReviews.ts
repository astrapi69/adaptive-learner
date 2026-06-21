/**
 * notifications/dueReviews — count the SRS reviews currently due for a
 * learner, for the daily-reminder feature (#723). Reuses the same queue +
 * dedup path as the header ``NavReviewsBadge`` so the reminder count and
 * the badge count never drift.
 */

import {getStorage} from "../../storage";
import {dedupeReviewQueueByElement} from "../review/review-lesson";

export interface DueReviewsSummary {
    /** Count of UNIQUE overdue elements (deduped across EXP-018 directions). */
    count: number;
    /** The first overdue element's set id, for the review-session deep link. */
    firstSetId: string | null;
}

/**
 * Read the active storage backing's review queue and summarise the
 * overdue elements. Never throws — returns an empty summary on any read
 * failure (the reminder is supplementary, not load-bearing).
 */
export async function getDueReviewsSummary(
    userId: string,
): Promise<DueReviewsSummary> {
    try {
        const queue = await getStorage().elementErrors.reviewQueue(userId);
        const overdue = dedupeReviewQueueByElement(
            queue.filter((item) => item.overdue),
        );
        return {
            count: overdue.length,
            firstSetId: overdue[0]?.set_id ?? null,
        };
    } catch {
        return {count: 0, firstSetId: null};
    }
}
