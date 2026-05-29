/**
 * Tests for the celebration queue (EXP-008 / Phase 55D).
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {
    clearMilestoneQueue,
    dequeueMilestone,
    enqueueMilestone,
    milestoneQueueLength,
    setMilestoneListener,
} from "./celebrationQueue";
import type {Milestone} from "./milestones";

function streak(value: number): Milestone {
    return {id: `streak-${value}`, type: "streak", value};
}

beforeEach(() => {
    clearMilestoneQueue();
});

describe("celebrationQueue", () => {
    it("enqueues + dequeues FIFO", () => {
        enqueueMilestone(streak(7));
        enqueueMilestone(streak(30));
        expect(milestoneQueueLength()).toBe(2);
        expect(dequeueMilestone()?.value).toBe(7);
        expect(dequeueMilestone()?.value).toBe(30);
        expect(dequeueMilestone()).toBeUndefined();
    });

    it("de-duplicates by id within a session", () => {
        enqueueMilestone(streak(7));
        enqueueMilestone(streak(7));
        expect(milestoneQueueLength()).toBe(1);
    });

    it("notifies the registered listener on enqueue", () => {
        const listener = vi.fn();
        const unsubscribe = setMilestoneListener(listener);
        enqueueMilestone(streak(7));
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
        enqueueMilestone(streak(30));
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("clear resets the queue + de-dup memory", () => {
        enqueueMilestone(streak(7));
        clearMilestoneQueue();
        expect(milestoneQueueLength()).toBe(0);
        // After clear the same id can be enqueued again.
        enqueueMilestone(streak(7));
        expect(milestoneQueueLength()).toBe(1);
    });
});
