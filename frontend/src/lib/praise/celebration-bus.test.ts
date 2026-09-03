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
    playSound: (name: string, opts?: {pitchSteps?: number}) =>
        opts === undefined ? playSound(name) : playSound(name, opts),
}));

import {
    celebrateBadge,
    celebrateMilestonesFromSnapshots,
    celebrateMissions,
    celebrateTierUpgrade,
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
        expect(playSound).toHaveBeenCalledWith("correct_answer", {pitchSteps: 0});
        expect(received).toEqual(["answer_correct"]);
        unsub();
    });

    it("maps wrong answers to the low thud", () => {
        emitCelebration({type: "answer_wrong"});
        expect(playSound).toHaveBeenCalledWith("wrong_answer", {pitchSteps: 0});
    });

    it("survives a throwing subscriber", () => {
        const unsub = subscribeCelebration(() => {
            throw new Error("boom");
        });
        expect(() => emitCelebration({type: "confetti"})).not.toThrow();
        expect(playSound).toHaveBeenCalledWith("confetti", {pitchSteps: 0});
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
        expect(playSound).toHaveBeenCalledWith("level_up", {pitchSteps: 0});
        expect(playSound).toHaveBeenCalledWith("star_earned", {
            pitchSteps: 0,
        });
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
        expect(playSound).toHaveBeenCalledWith("badge_earned", {
            pitchSteps: 0,
        });
    });
});

describe("celebrateMissions", () => {
    it("no-ops when nothing newly completed", () => {
        setFeedbackIntensity("normal");
        const r = celebrateMissions({
            newlyCompletedCount: 0,
            allComplete: false,
            lang: "en",
        });
        expect(r).toEqual({praise: null, allClear: false});
        expect(playSound).not.toHaveBeenCalled();
    });

    it("plays the mission sound + returns a praise phrase (normal)", () => {
        setFeedbackIntensity("normal");
        const r = celebrateMissions({
            newlyCompletedCount: 1,
            allComplete: false,
            lang: "en",
        });
        expect(playSound).toHaveBeenCalledWith("badge_earned", {pitchSteps: 0});
        expect(r.praise).toBeTruthy();
        expect(r.allClear).toBe(false);
    });

    it("fires the all-clear sound + flag when every mission is done", () => {
        setFeedbackIntensity("normal");
        const r = celebrateMissions({
            newlyCompletedCount: 2,
            allComplete: true,
            lang: "en",
        });
        expect(playSound).toHaveBeenCalledWith("level_up", {pitchSteps: 0});
        expect(r.allClear).toBe(true);
    });

    it("suppresses the praise phrase under subtle intensity", () => {
        setFeedbackIntensity("subtle");
        const r = celebrateMissions({
            newlyCompletedCount: 1,
            allComplete: false,
            lang: "en",
        });
        expect(r.praise).toBeNull();
    });
});

describe("celebrateTierUpgrade (Phase 57)", () => {
    it("silver upgrade plays the ascending chime + emits the event", () => {
        setFeedbackIntensity("enthusiastic");
        const events: string[] = [];
        const unsub = subscribeCelebration((e) => {
            if (e.type === "badge_tier_upgrade") {
                events.push(String(e.payload?.new_tier));
            }
        });
        celebrateTierUpgrade({
            key: "lessons_10",
            oldTier: "bronze",
            newTier: "silver",
            name: "Lessons",
            message: "Silver",
        });
        expect(playSound).toHaveBeenCalledWith("star_earned");
        expect(events).toEqual(["silver"]);
        expect(milestoneQueueLength()).toBe(1);
        unsub();
    });

    it("gold upgrade plays the triumphant level-up chord", () => {
        setFeedbackIntensity("enthusiastic");
        celebrateTierUpgrade({
            key: "review_master",
            oldTier: "silver",
            newTier: "gold",
            name: "Review",
            message: "Gold",
        });
        expect(playSound).toHaveBeenCalledWith("level_up");
        expect(milestoneQueueLength()).toBe(1);
    });

    it("subtle intensity: sound + event still fire but no overlay queued", () => {
        setFeedbackIntensity("subtle");
        let fired = false;
        const unsub = subscribeCelebration((e) => {
            if (e.type === "badge_tier_upgrade") fired = true;
        });
        celebrateTierUpgrade({
            key: "lessons_10",
            oldTier: "bronze",
            newTier: "silver",
            name: "Lessons",
            message: "Silver",
        });
        expect(playSound).toHaveBeenCalledWith("star_earned");
        expect(fired).toBe(true);
        expect(milestoneQueueLength()).toBe(0);
        unsub();
    });
});

describe("game-mode sounds (#2875)", async () => {
    const {setPlayfulMode} = await import("../learning/playful/playfulModePref");
    const {setPlayfulSounds} = await import("../learning/playful/playfulSoundsPref");

    function armGameSounds() {
        setPlayfulMode(true);
        setPlayfulSounds(true);
    }

    it("raises the correct-answer pitch with the streak and resets on a wrong answer", () => {
        armGameSounds();
        emitCelebration({type: "answer_correct"});
        emitCelebration({type: "answer_correct"});
        emitCelebration({type: "answer_correct"});
        expect(playSound).toHaveBeenNthCalledWith(1, "correct_answer", {
            pitchSteps: 0,
        });
        expect(playSound).toHaveBeenNthCalledWith(2, "correct_answer", {
            pitchSteps: 1,
        });
        expect(playSound).toHaveBeenNthCalledWith(3, "correct_answer", {
            pitchSteps: 2,
        });
        emitCelebration({type: "answer_wrong"});
        emitCelebration({type: "answer_correct"});
        expect(playSound).toHaveBeenLastCalledWith("correct_answer", {
            pitchSteps: 0,
        });
    });

    it("keeps the pitch flat outside game-mode sounds", () => {
        emitCelebration({type: "answer_wrong"});
        emitCelebration({type: "answer_correct"});
        emitCelebration({type: "answer_correct"});
        expect(playSound).toHaveBeenLastCalledWith("correct_answer", {
            pitchSteps: 0,
        });
    });

    it("plays the checkpoint jingle for the new event type", () => {
        armGameSounds();
        emitCelebration({type: "checkpoint"});
        expect(playSound).toHaveBeenCalledWith("checkpoint", {pitchSteps: 0});
    });

    it("plays the fanfare on lesson_complete only with game-mode sounds", () => {
        emitCelebration({type: "lesson_complete"});
        expect(playSound).not.toHaveBeenCalledWith("fanfare");
        armGameSounds();
        emitCelebration({type: "lesson_complete"});
        expect(playSound).toHaveBeenCalledWith("fanfare");
    });
});
