/**
 * Celebration queue (EXP-008 / Phase 55D).
 *
 * A tiny module-level FIFO of milestones plus a single-listener
 * notifier. Producers (the celebration bus, 55G) call
 * ``enqueueMilestone``; the ``MilestoneHost`` registers a listener
 * and drains the queue one milestone at a time so multiple
 * milestones triggered together are shown sequentially rather
 * than stacked.
 *
 * Kept independent of React so any module can enqueue without a
 * provider in scope.
 */

import type {Milestone} from "./milestones";

const queue: Milestone[] = [];
let listener: (() => void) | null = null;
const seenIds = new Set<string>();

/** Enqueue a milestone for display. De-duplicates by ``id`` for
 *  the lifetime of the page so the same threshold is not
 *  celebrated twice in one session. */
export function enqueueMilestone(milestone: Milestone): void {
    if (seenIds.has(milestone.id)) return;
    seenIds.add(milestone.id);
    queue.push(milestone);
    listener?.();
}

/** Register the (single) host listener. Returns an unsubscribe. */
export function setMilestoneListener(cb: () => void): () => void {
    listener = cb;
    return () => {
        if (listener === cb) listener = null;
    };
}

/** Remove and return the next milestone, or undefined if empty. */
export function dequeueMilestone(): Milestone | undefined {
    return queue.shift();
}

export function milestoneQueueLength(): number {
    return queue.length;
}

/** Clear the queue + de-dup memory (tests + explicit resets). */
export function clearMilestoneQueue(): void {
    queue.length = 0;
    seenIds.clear();
}
