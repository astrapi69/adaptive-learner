/**
 * review/review-queue — the ONE entry point for reading the SRS review
 * queue from the UI (#3170).
 *
 * Every consumer of ``elementErrors.reviewQueue`` (the review session,
 * the header badge, the dashboard card, the reminder, the next-step
 * suggestions, the endless stream) must agree on whether never-wrong
 * elements are due. That decision is the learner's Settings > Learning
 * toggle ("Auch fehlerfreie Elemente wiederholen"), so it is applied here
 * and nowhere else: callers pass their usual options and get the queue
 * for the active storage backing.
 *
 * @example
 * const queue = await loadReviewQueue(userId, {setId});
 */

import {readReviewIncludeNeverWrong} from "../learning/reviewIncludeNeverWrongPref";
import {getStorage} from "../../storage";
import type {ReviewQueueItem} from "../../storage/types";

export interface LoadReviewQueueOpts {
    setId?: string;
    /** #603 — cap the returned list. */
    limit?: number;
    /** Explicit override; omitted, the Settings > Learning toggle decides. */
    includeNeverWrong?: boolean;
}

/** Read the review queue with the learner's never-wrong preference applied. */
export function loadReviewQueue(
    userId: string,
    opts: LoadReviewQueueOpts = {},
): Promise<ReviewQueueItem[]> {
    const includeNeverWrong =
        opts.includeNeverWrong ?? readReviewIncludeNeverWrong();
    return getStorage().elementErrors.reviewQueue(userId, {
        ...opts,
        includeNeverWrong,
    });
}
