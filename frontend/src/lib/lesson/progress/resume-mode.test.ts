import {describe, expect, it} from "vitest";

import {resumeModeConflict} from "./resume-mode";

/** A stored run: answers given in ``mode``, in the given lifecycle state. */
function run(mode: string | undefined, status: string, answered = 3) {
    const step_results: Record<string, unknown> = {};
    for (let i = 0; i < answered; i++) step_results[`ex-${i}`] = {correct: 1, total: 1};
    return {status, step_results, lesson_mode: mode};
}

describe("resumeModeConflict (#3742)", () => {
    it.each([
        // The reproduction: practice answers must not continue as an exam.
        ["paused practice run opened in exam", run("practice", "paused"), "exam", true],
        ["in-progress practice run opened in exam", run("practice", "in_progress"), "exam", true],
        // The reverse: exam answers must not continue as practice.
        ["paused exam run opened in practice", run("exam", "paused"), "practice", true],
        ["exam run opened in timed", run("exam", "paused"), "timed", true],
        // Same mode: resume as today.
        ["exam run opened in exam", run("exam", "paused"), "exam", false],
        ["practice run opened in practice", run("practice", "paused"), "practice", false],
        // Neither side is an exam: resume as today.
        ["practice run opened in timed", run("practice", "paused"), "timed", false],
        // A completed run starts fresh anyway.
        ["completed practice run opened in exam", run("practice", "completed"), "exam", false],
        // Nothing answered yet: no answer can be misjudged.
        ["practice run without answers opened in exam", run("practice", "paused", 0), "exam", false],
        // A row from before the mode was stored counts as practice.
        ["run without a stored mode opened in exam", run(undefined, "paused"), "exam", true],
    ] as const)("%s -> %s", (_name, progress, mode, conflict) => {
        expect(resumeModeConflict(progress, mode)).toBe(conflict);
    });

    it("has no conflict without a stored run", () => {
        expect(resumeModeConflict(null, "exam")).toBe(false);
    });
});
