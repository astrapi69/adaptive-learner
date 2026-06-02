/**
 * markdownToSpeech + theory-run helpers (TTS features C2 / C5 / C7).
 */

import {describe, expect, it} from "vitest";

import {
    collectTheoryRun,
    markdownToSpeech,
    runStepForChar,
    theoryBlockAround,
} from "./tts-text";

describe("markdownToSpeech", () => {
    it("strips headings, emphasis, and inline code, keeping the words", () => {
        const out = markdownToSpeech(
            "# Title\n\nSome **bold** and `code` and *em* text.",
        );
        expect(out).not.toContain("#");
        expect(out).not.toContain("**");
        expect(out).not.toContain("`");
        expect(out).toContain("Some bold and code and em text.");
    });

    it("drops fenced code blocks entirely", () => {
        const out = markdownToSpeech(
            "Intro line.\n\n```python\nprint('x')\n```\n\nAfter.",
        );
        expect(out).not.toContain("print");
        expect(out).toContain("Intro line");
        expect(out).toContain("After");
    });

    it("collapses links + images to their text", () => {
        expect(markdownToSpeech("See [the docs](https://x.y).")).toContain(
            "See the docs.",
        );
        expect(markdownToSpeech("![alt text](img.png)")).toBe("alt text");
    });

    it("returns empty for empty / code-only input", () => {
        expect(markdownToSpeech("")).toBe("");
        expect(markdownToSpeech("```\ncode only\n```")).toBe("");
    });
});

describe("collectTheoryRun", () => {
    const steps = [
        {type: "theory", body: "Alpha."},
        {type: "theory", body: "Beta."},
        {type: "exercise", body: null},
        {type: "theory", body: "Gamma."},
    ];

    it("collects consecutive theory steps and stops at an exercise", () => {
        const run = collectTheoryRun(steps, 0);
        expect(run.indices).toEqual([0, 1]);
        expect(run.text).toBe("Alpha. Beta.");
        expect(run.offsets).toEqual([0, 7]); // "Alpha. " = 7 chars
    });

    it("returns a single-step run when the next step is an exercise", () => {
        const run = collectTheoryRun(steps, 1);
        expect(run.indices).toEqual([1]);
    });

    it("returns an empty run when starting on an exercise", () => {
        const run = collectTheoryRun(steps, 2);
        expect(run.indices).toEqual([]);
        expect(run.text).toBe("");
    });
});

describe("runStepForChar", () => {
    const run = collectTheoryRun(
        [
            {type: "theory", body: "Alpha."},
            {type: "theory", body: "Beta."},
        ],
        0,
    );
    it("maps a char offset back to its absolute step index", () => {
        expect(runStepForChar(run, 0)).toBe(0); // within "Alpha."
        expect(runStepForChar(run, 6)).toBe(0); // the separator space
        expect(runStepForChar(run, 7)).toBe(1); // start of "Beta."
        expect(runStepForChar(run, 99)).toBe(1); // past end -> last step
    });
});

describe("theoryBlockAround", () => {
    const steps = [
        {type: "theory", body: "A"},
        {type: "theory", body: "B"},
        {type: "theory", body: "C"},
        {type: "exercise", body: null},
        {type: "theory", body: "D"},
    ];

    it("returns the contiguous block + 1-based position for a theory step", () => {
        expect(theoryBlockAround(steps, 1)).toEqual({
            start: 0,
            end: 2,
            position: 2,
            total: 3,
        });
    });

    it("scans both directions from the middle of a block", () => {
        expect(theoryBlockAround(steps, 0)).toEqual({
            start: 0,
            end: 2,
            position: 1,
            total: 3,
        });
        expect(theoryBlockAround(steps, 4)).toEqual({
            start: 4,
            end: 4,
            position: 1,
            total: 1,
        });
    });

    it("returns null for a non-theory step or out-of-range index", () => {
        expect(theoryBlockAround(steps, 3)).toBeNull();
        expect(theoryBlockAround(steps, 99)).toBeNull();
    });
});
