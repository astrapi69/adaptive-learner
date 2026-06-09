import {describe, it, expect} from "vitest";

import type {ContentLessonStep} from "../../storage/types";
import {findPrecedingTheoryIndex} from "./theory-link";

function step(
    id: string,
    type: "theory" | "exercise",
): ContentLessonStep {
    return {id, type} as ContentLessonStep;
}

const STEPS: ContentLessonStep[] = [
    step("t0", "theory"),
    step("e1", "exercise"),
    step("e2", "exercise"),
    step("t3", "theory"),
    step("e4", "exercise"),
];

describe("findPrecedingTheoryIndex", () => {
    it("returns the nearest theory step before an exercise", () => {
        expect(findPrecedingTheoryIndex(STEPS, 1)).toBe(0);
        expect(findPrecedingTheoryIndex(STEPS, 2)).toBe(0);
        expect(findPrecedingTheoryIndex(STEPS, 4)).toBe(3);
    });

    it("returns null when the current step is itself theory", () => {
        expect(findPrecedingTheoryIndex(STEPS, 0)).toBeNull();
        expect(findPrecedingTheoryIndex(STEPS, 3)).toBeNull();
    });

    it("returns null when no theory step precedes the exercise", () => {
        const noLeadingTheory = [step("e0", "exercise"), step("e1", "exercise")];
        expect(findPrecedingTheoryIndex(noLeadingTheory, 1)).toBeNull();
    });

    it("returns null for an out-of-range index", () => {
        expect(findPrecedingTheoryIndex(STEPS, 99)).toBeNull();
        expect(findPrecedingTheoryIndex(STEPS, -1)).toBeNull();
    });
});
