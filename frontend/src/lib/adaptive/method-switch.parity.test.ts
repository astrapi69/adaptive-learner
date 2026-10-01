/**
 * Cross-language parity for the method-switch rule (#3396).
 *
 * Mirrors ``plugins/adaptive-learner-plugin-session/tests/
 * test_switching_parity.py``; both read ``tests/fixtures/method-switch-parity/``.
 * Python regenerates the goldens; this test only asserts.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { recommendMethodSwitch, type SwitchRatingInput } from "./method-switch";

const FIXTURE_DIR = join(__dirname, "..", "..", "..", "..", "tests", "fixtures", "method-switch-parity");

interface SwitchCase {
  name: string;
  current_method: string;
  recent_ratings: SwitchRatingInput[];
  profile?: Record<string, number>;
  recently_used_methods?: string[];
}

const cases = JSON.parse(readFileSync(join(FIXTURE_DIR, "input.json"), "utf-8")).cases as SwitchCase[];
const expected = JSON.parse(readFileSync(join(FIXTURE_DIR, "expected.json"), "utf-8")) as Record<
  string,
  unknown
>;

describe("method-switch rule parity (#3396)", () => {
  it("reads a non-empty fixture", () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
  });

  it.each(cases.map((c) => [c.name, c] as const))("%s matches the Python golden", (name, c) => {
    const result = recommendMethodSwitch("p1", c.current_method, c.recent_ratings, {
      profile: c.profile,
      recentlyUsedMethods: c.recently_used_methods,
    });
    expect(result).toEqual(expected[name]);
  });
});
