/**
 * Cross-language parity for the lesson splitter (Phase 63G / EXP-020).
 *
 * Mirrors ``plugins/adaptive-learner-plugin-content-loader/tests/
 * test_lesson_splitter.py``. Both tests read the same fixture at
 * ``tests/fixtures/lesson-splitter-parity/`` and assert against the
 * same goldens. Python is the canonical golden generator (run
 * ``LESSON_SPLITTER_PARITY_REGEN=1`` on the Python side to update);
 * this TS test only asserts — never regenerates.
 *
 * If this test fails after a Python source change, the regen was
 * intentional and the TS port in ``lesson-splitter.ts`` must converge.
 * If this test fails without a Python change, the TS port has drifted.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import type {ContentLesson} from "../../storage/types";
import {splitLesson} from "./lesson-splitter";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const FIXTURE_DIR = join(
    REPO_ROOT,
    "tests",
    "fixtures",
    "lesson-splitter-parity",
);

function loadInput(): ContentLesson {
    return JSON.parse(
        readFileSync(join(FIXTURE_DIR, "input.json"), "utf-8"),
    ) as ContentLesson;
}

function loadGolden(name: string): unknown {
    return JSON.parse(
        readFileSync(join(FIXTURE_DIR, "expected", `${name}.json`), "utf-8"),
    );
}

/** Structural summary that matches the Python golden format. */
function summarize(parts: ContentLesson[]) {
    return parts.map((p) => ({
        id: p.id,
        title: p.title,
        estimated_minutes: p.estimated_minutes,
        step_ids: p.steps.map((s) => s.id),
        card_ids: p.cards.map((c) => c.id),
    }));
}

describe("lesson-splitter parity", () => {
    it("split3: 8 steps → 3 parts of ≤3 steps each", () => {
        const lesson = loadInput();
        const parts = splitLesson(lesson, {maxStepsPerPart: 3});
        expect(summarize(parts)).toEqual(loadGolden("split3"));
    });

    it("split4: 8 steps → 2 parts of ≤4 steps each", () => {
        const lesson = loadInput();
        const parts = splitLesson(lesson, {maxStepsPerPart: 4});
        expect(summarize(parts)).toEqual(loadGolden("split4"));
    });

    it("no_split: ≤maxSteps → single part (same lesson)", () => {
        const lesson = loadInput();
        const parts = splitLesson(lesson, {maxStepsPerPart: 10});
        expect(parts).toHaveLength(1);
        expect(parts[0]).toBe(lesson); // same reference — no copy
        expect(summarize(parts)).toEqual(loadGolden("no_split"));
    });
});
