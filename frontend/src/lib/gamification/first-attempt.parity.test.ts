/**
 * First-attempt detector cross-language parity (Phase 50C /
 * v1.33.0 / D-DEXIE-GAMIFICATION).
 *
 * Mirrors the Python
 * ``test_is_first_attempt_from_step_results_matches_inline_expected``
 * test in ``plugins/adaptive-learner-plugin-gamification/
 * tests/test_xp_parity.py``. Both read the same fixture and
 * assert the same booleans for every JSON-payload edge case
 * (null, malformed, top-level array, empty dict, attempts as
 * int/float/string/boolean, multi-step variants).
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {isFirstAttempt} from "./first-attempt";

// Walk up: __dirname = frontend/src/lib/gamification
// repo root = ../../../..
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const INPUT_PATH = join(
    REPO_ROOT,
    "tests",
    "fixtures",
    "lesson-xp-parity",
    "input.json",
);

interface FirstAttemptCase {
    name: string;
    step_results: string | null;
    expected: boolean;
}

function loadFirstAttemptCases(): FirstAttemptCase[] {
    const fixture = JSON.parse(readFileSync(INPUT_PATH, "utf-8"));
    return fixture.first_attempt_cases;
}

describe("isFirstAttempt cross-language parity", () => {
    it("matches the Python expected boolean for every fixture case", () => {
        for (const c of loadFirstAttemptCases()) {
            const actual = isFirstAttempt(c.step_results);
            expect(actual, `first-attempt case '${c.name}'`).toBe(c.expected);
        }
    });
});
