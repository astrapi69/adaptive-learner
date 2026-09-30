/**
 * Cross-language parity for the step-evaluation insights (#3394).
 *
 * Mirrors ``plugins/adaptive-learner-plugin-tracking/tests/
 * test_step_eval_parity.py``: both read ``tests/fixtures/step-eval-parity/``.
 * Python regenerates the goldens; this test only asserts.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { aggregateStepEvaluations, type StepEvaluationInput } from "./step-evaluation-summary";

const FIXTURE_DIR = join(__dirname, "..", "..", "..", "..", "tests", "fixtures", "step-eval-parity");

const cases = JSON.parse(readFileSync(join(FIXTURE_DIR, "input.json"), "utf-8")).cases as {
  name: string;
  rows: StepEvaluationInput[];
}[];
const expected = JSON.parse(readFileSync(join(FIXTURE_DIR, "expected.json"), "utf-8")) as Record<
  string,
  unknown
>;

describe("step-evaluation aggregate parity (#3394)", () => {
  it("reads a non-empty fixture", () => {
    expect(cases.length).toBeGreaterThanOrEqual(4);
  });

  it.each(cases.map((c) => [c.name, c.rows] as const))("%s matches the Python golden", (name, rows) => {
    expect(aggregateStepEvaluations(rows)).toEqual(expected[name]);
  });
});
