/**
 * #3170 - "Auch fehlerfreie Elemente wiederholen" preference (Settings >
 * Learning > Review). Same localStorage pattern as ``reviewLimitPref``.
 */

import {afterEach, describe, expect, it} from "vitest";

import {
    DEFAULT_REVIEW_INCLUDE_NEVER_WRONG,
    REVIEW_INCLUDE_NEVER_WRONG_PREF_KEY,
    readReviewIncludeNeverWrong,
    writeReviewIncludeNeverWrong,
} from "./reviewIncludeNeverWrongPref";

afterEach(() => localStorage.clear());

describe("reviewIncludeNeverWrongPref (#3170)", () => {
    it("defaults to OFF (error training is error training)", () => {
        expect(readReviewIncludeNeverWrong()).toBe(false);
        expect(DEFAULT_REVIEW_INCLUDE_NEVER_WRONG).toBe(false);
    });

    it("round-trips ON and back to OFF", () => {
        writeReviewIncludeNeverWrong(true);
        expect(readReviewIncludeNeverWrong()).toBe(true);
        writeReviewIncludeNeverWrong(false);
        expect(readReviewIncludeNeverWrong()).toBe(false);
    });

    it.each(["yes", "1", "", "TRUE "])(
        "falls back to the default for an unparseable stored value (%j)",
        (raw) => {
            localStorage.setItem(REVIEW_INCLUDE_NEVER_WRONG_PREF_KEY, raw);
            expect(readReviewIncludeNeverWrong()).toBe(
                DEFAULT_REVIEW_INCLUDE_NEVER_WRONG,
            );
        },
    );

    it("uses the adaptive-learner. prefix so the value rides the .alb backup", () => {
        expect(REVIEW_INCLUDE_NEVER_WRONG_PREF_KEY.startsWith("adaptive-learner.")).toBe(
            true,
        );
    });
});
