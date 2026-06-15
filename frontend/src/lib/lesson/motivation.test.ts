import {describe, it, expect} from "vitest";

import {lessonMotivation} from "./motivation";

describe("lessonMotivation", () => {
    it("returns null for trivial / out-of-range lessons", () => {
        expect(lessonMotivation(0, 1)).toBeNull();
        expect(lessonMotivation(0, 0)).toBeNull();
        expect(lessonMotivation(-1, 5)).toBeNull();
        expect(lessonMotivation(5, 5)).toBeNull();
    });

    it("flags the last step", () => {
        expect(lessonMotivation(4, 5)).toBe("last");
        expect(lessonMotivation(1, 2)).toBe("last");
    });

    it("flags the halfway step of a longer lesson", () => {
        // 8 steps → halfway index 4.
        expect(lessonMotivation(4, 8)).toBe("halftime");
        // 6 steps → halfway index 3.
        expect(lessonMotivation(3, 6)).toBe("halftime");
    });

    it("does not fire halftime for short lessons", () => {
        // 3 steps → index 1 is neither last nor a halftime candidate.
        expect(lessonMotivation(1, 3)).toBeNull();
    });

    it("prefers 'last' when halfway collides with the final step", () => {
        // 2 steps → index 1 is both; last wins.
        expect(lessonMotivation(1, 2)).toBe("last");
    });

    it("returns null on ordinary middle steps", () => {
        expect(lessonMotivation(1, 8)).toBeNull();
        expect(lessonMotivation(6, 8)).toBeNull();
    });
});
