import {describe, expect, it} from "vitest";

import {generateShareText, SHARE_URL} from "./generate-share-text";

const t = (key: string, fallback?: string) => fallback ?? key;

describe("generateShareText", () => {
    it("interpolates the streak day count", () => {
        const {text, url} = generateShareText({kind: "streak", days: 30}, t);
        expect(text).toContain("30");
        expect(text).toContain("#AdaptiveLearner");
        expect(url).toBe(SHARE_URL);
    });

    it("interpolates the level for a level-up share", () => {
        const {text} = generateShareText({kind: "level", level: 5}, t);
        expect(text).toContain("5");
    });

    it("includes the badge name", () => {
        const {text} = generateShareText(
            {kind: "badge", badge: "Streak Master"},
            t,
        );
        expect(text).toContain("Streak Master");
    });

    it("combines level + streak in the progress share", () => {
        const {text} = generateShareText(
            {kind: "progress", level: 3, days: 7},
            t,
        );
        expect(text).toContain("3");
        expect(text).toContain("7");
    });

    it("uses the localized template when t provides one", () => {
        const localized = (key: string, fallback?: string) =>
            key === "share.achievement.streak"
                ? "{days} Tage am Stück! Adaptive Learner"
                : key === "share.achievement.hashtag"
                  ? "#AdaptiveLearner"
                  : (fallback ?? key);
        const {text} = generateShareText({kind: "streak", days: 12}, localized);
        expect(text).toBe("12 Tage am Stück! Adaptive Learner #AdaptiveLearner");
    });

    it("contains no personal data (no name fields are accepted)", () => {
        // The input type has no name/email field by construction; this
        // asserts the produced text only reflects the numeric/label inputs.
        const {text} = generateShareText(
            {kind: "progress", level: 4, days: 9, language: "Spanish"},
            t,
        );
        expect(text).not.toMatch(/@/); // no email
        expect(text).toContain("Adaptive Learner");
    });

    it("does not crash on missing optional values (defaults to 0)", () => {
        const {text} = generateShareText({kind: "streak"}, t);
        expect(text).toContain("0");
    });
});
