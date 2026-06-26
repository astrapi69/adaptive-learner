/**
 * Tests for the lesson-result share builder (#1073): motivation tiers,
 * tier-varied CTA labels, and the PII-free interpolated share text.
 */

import {describe, expect, it} from "vitest";

import {
    buildLessonShareText,
    motivationTier,
    shareCtaLabel,
    type LessonShareResult,
} from "./lesson-share";

/** Identity-ish ``t``: returns the fallback with no catalog (keeps the test
 *  independent of i18n), so we assert on the fallback templates. */
const t = (_key: string, fallback?: string) => fallback ?? "";

function result(over: Partial<LessonShareResult>): LessonShareResult {
    return {
        lessonTitle: "Ansible basics",
        correct: 8,
        total: 10,
        scorePct: 80,
        stars: 2,
        ...over,
    };
}

describe("motivationTier", () => {
    it("is 'record' on a new record / level-up / 7-day streak", () => {
        expect(motivationTier(result({isNewRecord: true}))).toBe("record");
        expect(motivationTier(result({leveledUp: true}))).toBe("record");
        expect(motivationTier(result({streakDays: 7, scorePct: 30}))).toBe(
            "record",
        );
    });

    it("is 'great' at >= 80% without a record trigger", () => {
        expect(motivationTier(result({scorePct: 80, streakDays: 1}))).toBe(
            "great",
        );
    });

    it("is 'low' below 50%", () => {
        expect(motivationTier(result({scorePct: 40}))).toBe("low");
    });

    it("is 'neutral' between 50% and 79%", () => {
        expect(motivationTier(result({scorePct: 65}))).toBe("neutral");
    });
});

describe("shareCtaLabel", () => {
    it("varies the label by tier", () => {
        expect(shareCtaLabel(result({scorePct: 95, isNewRecord: true}), t)).toBe(
            "Show your friends!",
        );
        expect(shareCtaLabel(result({scorePct: 85}), t)).toBe(
            "Share your great result!",
        );
        expect(shareCtaLabel(result({scorePct: 65}), t)).toBe("Share result");
        // A low score stays quiet — never a celebratory CTA.
        expect(shareCtaLabel(result({scorePct: 20}), t)).toBe("Share result");
    });
});

describe("buildLessonShareText", () => {
    it("interpolates title + score + count, PII-free, with the hashtag", () => {
        const {text, url} = buildLessonShareText(
            result({lessonTitle: "Ansible basics", scorePct: 80, correct: 8, total: 10}),
            t,
        );
        expect(text).toBe(
            'I completed "Ansible basics" with 80%! 🎓 8 of 10 correct. #AdaptiveLearner',
        );
        expect(url).toBe("https://astrapi69.github.io/adaptive-learner/");
        // No personal data leaks into the text.
        expect(text).not.toMatch(/user|@|id/i);
    });
});
