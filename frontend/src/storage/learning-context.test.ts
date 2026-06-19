/**
 * Learning-progress context builder (#797) — pure formatter unit tests +
 * a cross-language parity golden against the Python ``build_learning_context``
 * (the two builders must emit byte-identical output for the same input).
 */

import {readFileSync} from "node:fs";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {
    buildLearningContext,
    type LearningContext,
} from "./prompts";

const FIXTURE_DIR = path.resolve(
    process.cwd(),
    "../tests/fixtures/learning-context-parity",
);

function readFixture(name: string): string {
    return readFileSync(path.join(FIXTURE_DIR, name), "utf-8");
}

describe("buildLearningContext", () => {
    it("returns '' when the learner has no lesson activity", () => {
        expect(
            buildLearningContext(
                {topic: "X", completed: [], inProgress: null, mistakes: []},
                "en",
            ),
        ).toBe("");
        expect(buildLearningContext(null, "de")).toBe("");
    });

    it("renders completed lessons with scores", () => {
        const out = buildLearningContext(
            {
                topic: "French",
                completed: [{label: "fr — 01", correct: 8, total: 10}],
                inProgress: null,
                mistakes: [],
            },
            "en",
        );
        expect(out).toContain("Completed lessons: fr — 01 (8/10)");
        expect(out).toContain('You are a tutor for "French"');
    });

    it("renders the in-progress lesson and recent mistakes", () => {
        const out = buildLearningContext(
            {
                topic: "French",
                completed: [],
                inProgress: {label: "fr — 02", step: 3},
                mistakes: [
                    {element: "bonjour", answered: "bonsoir", expected: "bonjour", count: 2},
                ],
            },
            "en",
        );
        expect(out).toContain("Currently working on: fr — 02, step 3");
        expect(out).toContain(
            'bonjour (answered "bonsoir", correct "bonjour", 2x)',
        );
        // No completed lessons -> the "none yet" placeholder.
        expect(out).toContain("Completed lessons: none yet");
    });

    it("caps completed lessons at 12 and mistakes at 8", () => {
        const completed = Array.from({length: 20}, (_, i) => ({
            label: `l${i}`,
            correct: 1,
            total: 1,
        }));
        const mistakes = Array.from({length: 20}, (_, i) => ({
            element: `e${i}`,
            answered: "a",
            expected: "b",
            count: 1,
        }));
        const out = buildLearningContext(
            {topic: "T", completed, inProgress: null, mistakes},
            "en",
        );
        expect(out).toContain("l11");
        expect(out).not.toContain("l12");
        expect(out).toContain("e7");
        expect(out).not.toContain("e8 ");
    });

    it("uses German labels for a 'de' language", () => {
        const out = buildLearningContext(
            {
                topic: "Französisch",
                completed: [{label: "fr — 01", correct: 8, total: 10}],
                inProgress: null,
                mistakes: [],
            },
            "de",
        );
        expect(out).toContain("LERNKONTEXT");
        expect(out).toContain("Abgeschlossene Lektionen:");
        expect(out).toContain('Du bist ein Tutor fuer "Französisch"');
    });
});

describe("cross-language parity with the Python build_learning_context", () => {
    interface FixtureInput {
        topic: string;
        completed: {label: string; correct: number; total: number}[];
        in_progress: {label: string; step: number} | null;
        mistakes: {element: string; answered: string; expected: string; count: number}[];
    }

    function load(): LearningContext {
        const raw = JSON.parse(readFixture("input.json")) as FixtureInput;
        return {
            topic: raw.topic,
            completed: raw.completed,
            inProgress: raw.in_progress,
            mistakes: raw.mistakes,
        };
    }

    it("matches the EN golden byte-for-byte", () => {
        expect(buildLearningContext(load(), "en")).toBe(readFixture("golden.en.txt"));
    });

    it("matches the DE golden byte-for-byte", () => {
        expect(buildLearningContext(load(), "de")).toBe(readFixture("golden.de.txt"));
    });
});
