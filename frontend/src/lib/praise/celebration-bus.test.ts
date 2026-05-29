/**
 * Tests for the celebration bus (EXP-008 / Phase 55G).
 *
 * Pins:
 *  - emit plays the mapped sound + notifies subscribers,
 *  - milestone helpers enqueue overlays + are gated on intensity,
 *  - a faulty subscriber does not break the emit.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const playSound = vi.fn();
vi.mock("../audio/sound-effects", () => ({
    playSound: (name: string) => playSound(name),
}));

import {
    celebrateBadge,
    celebrateMilestonesFromSnapshots,
    emitCelebration,
    subscribeCelebration,
} from "./celebration-bus";
import {
    clearMilestoneQueue,
    milestoneQueueLength,
} from "../feedback/celebrationQueue";
import {setFeedbackIntensity} from "../feedback/feedbackPref";

beforeEach(() => {
    localStorage.clear();
    clearMilestoneQueue();
    playSound.mockClear();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("emitCelebration", () => {
    it("plays the mapped sound and notifies subscribers", () => {
        const received: string[] = [];
        const unsub = subscribeCelebration((e) => received.push(e.type));
        emitCelebration({type: "answer_correct"});
        expect(playSound).toHaveBeenCalledWith("correct_answer");
        expect(received).toEqual(["answer_correct"]);
        unsub();
    });

    it("maps wrong answers to the low thud", () => {
        emitCelebration({type: "answer_wrong"});
        expect(playSound).toHaveBeenCalledWith("wrong_answer");
    });

    it("survives a throwing subscriber", () => {
        const unsub = subscribeCelebration(() => {
            throw new Error("boom");
        });
        expect(() => emitCelebration({type: "confetti"})).not.toThrow();
        expect(playSound).toHaveBeenCalledWith("confetti");
        unsub();
    });
});

describe("milestone helpers", () => {
    it("enqueues milestones detected between snapshots (normal intensity)", () => {
        setFeedbackIntensity("normal");
        const celebrated = celebrateMilestonesFromSnapshots(
            {streakDays: 6, masteredCount: 0, level: 1},
            {streakDays: 7, masteredCount: 0, level: 2},
        );
        expect(celebrated.map((m) => m.type).sort()).toEqual([
            "level_up",
            "streak",
        ]);
        expect(milestoneQueueLength()).toBe(2);
        expect(playSound).toHaveBeenCalledWith("level_up");
        expect(playSound).toHaveBeenCalledWith("star_earned");
    });

    it("is suppressed under subtle intensity", () => {
        setFeedbackIntensity("subtle");
        const celebrated = celebrateMilestonesFromSnapshots(
            {streakDays: 6, masteredCount: 0, level: 1},
            {streakDays: 7, masteredCount: 0, level: 2},
        );
        expect(celebrated).toEqual([]);
        expect(milestoneQueueLength()).toBe(0);
    });

    it("celebrateBadge enqueues + plays the jingle", () => {
        setFeedbackIntensity("normal");
        celebrateBadge("streak_3_days", "Consistent", "3 days running");
        expect(milestoneQueueLength()).toBe(1);
        expect(playSound).toHaveBeenCalledWith("badge_earned");
    });
});
