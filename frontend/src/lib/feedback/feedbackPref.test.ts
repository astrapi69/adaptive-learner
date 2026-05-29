/**
 * Tests for the feedback-preference store + intensity helpers
 * (EXP-008 / Phase 55). Covers the round-trip persistence, the
 * reduced-motion override, and the per-level gating helpers that
 * 55E asserts ("each level controls the right features").
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {
    allowsConfetti,
    allowsMilestones,
    DEFAULT_INTENSITY,
    effectiveIntensity,
    nextCorrectAnswerIndex,
    readFeedbackIntensity,
    readSoundEnabled,
    readSoundVolume,
    resetCorrectAnswerCount,
    setFeedbackIntensity,
    setSoundEnabled,
    setSoundVolume,
    shouldPraiseCorrect,
    type FeedbackIntensity,
} from "./feedbackPref";

beforeEach(() => {
    localStorage.clear();
    resetCorrectAnswerCount();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("feedbackPref — persistence", () => {
    it("defaults to normal intensity", () => {
        expect(readFeedbackIntensity()).toBe("normal");
        expect(DEFAULT_INTENSITY).toBe("normal");
    });

    it("round-trips each intensity level", () => {
        for (const level of [
            "subtle",
            "normal",
            "enthusiastic",
        ] as FeedbackIntensity[]) {
            setFeedbackIntensity(level);
            expect(readFeedbackIntensity()).toBe(level);
        }
    });

    it("ignores a corrupt stored intensity", () => {
        localStorage.setItem("adaptive-learner.feedback.intensity", "loud");
        expect(readFeedbackIntensity()).toBe("normal");
    });

    it("sound defaults to OFF, volume defaults to 50", () => {
        expect(readSoundEnabled()).toBe(false);
        expect(readSoundVolume()).toBe(50);
    });

    it("round-trips sound enabled + volume (clamped 0..100)", () => {
        setSoundEnabled(true);
        expect(readSoundEnabled()).toBe(true);
        setSoundVolume(150);
        expect(readSoundVolume()).toBe(100);
        setSoundVolume(-20);
        expect(readSoundVolume()).toBe(0);
        setSoundVolume(33);
        expect(readSoundVolume()).toBe(33);
    });
});

describe("feedbackPref — gating helpers", () => {
    it("confetti + milestones allowed for normal/enthusiastic, not subtle", () => {
        expect(allowsConfetti("subtle")).toBe(false);
        expect(allowsConfetti("normal")).toBe(true);
        expect(allowsConfetti("enthusiastic")).toBe(true);
        expect(allowsMilestones("subtle")).toBe(false);
        expect(allowsMilestones("normal")).toBe(true);
        expect(allowsMilestones("enthusiastic")).toBe(true);
    });

    it("subtle never praises a correct answer", () => {
        for (let i = 0; i < 10; i++) {
            expect(shouldPraiseCorrect("subtle", i)).toBe(false);
        }
    });

    it("enthusiastic praises every correct answer", () => {
        for (let i = 0; i < 10; i++) {
            expect(shouldPraiseCorrect("enthusiastic", i)).toBe(true);
        }
    });

    it("normal praises periodically (every 3rd, starting at the first)", () => {
        const praised = [0, 1, 2, 3, 4, 5, 6].map((i) =>
            shouldPraiseCorrect("normal", i),
        );
        expect(praised).toEqual([true, false, false, true, false, false, true]);
    });
});

describe("feedbackPref — correct-answer counter", () => {
    it("advances then resets", () => {
        expect(nextCorrectAnswerIndex()).toBe(0);
        expect(nextCorrectAnswerIndex()).toBe(1);
        expect(nextCorrectAnswerIndex()).toBe(2);
        resetCorrectAnswerCount();
        expect(nextCorrectAnswerIndex()).toBe(0);
    });
});

describe("feedbackPref — reduced-motion override", () => {
    it("forces subtle when prefers-reduced-motion matches", () => {
        setFeedbackIntensity("enthusiastic");
        vi.stubGlobal(
            "matchMedia",
            vi.fn(() => ({
                matches: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        );
        expect(effectiveIntensity()).toBe("subtle");
    });

    it("uses the stored level when reduced motion is not requested", () => {
        setFeedbackIntensity("enthusiastic");
        vi.stubGlobal(
            "matchMedia",
            vi.fn(() => ({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        );
        expect(effectiveIntensity()).toBe("enthusiastic");
    });
});
