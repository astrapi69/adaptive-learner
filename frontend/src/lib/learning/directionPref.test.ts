/**
 * EXP-018 / Phase 62 — direction-strategy preference.
 */

import {afterEach, describe, expect, it} from "vitest";

import {
  DEFAULT_DIRECTION_STRATEGY,
  readDirectionStrategy,
  writeDirectionStrategy,
} from "./directionPref";

afterEach(() => {
  localStorage.clear();
});

describe("directionPref", () => {
  it("defaults to auto when unset", () => {
    expect(readDirectionStrategy()).toBe("auto");
    expect(DEFAULT_DIRECTION_STRATEGY).toBe("auto");
  });

  it("round-trips a written value", () => {
    writeDirectionStrategy("productive_focus");
    expect(readDirectionStrategy()).toBe("productive_focus");
  });

  it("ignores an invalid stored value and falls back to the default", () => {
    localStorage.setItem("adaptive-learner.direction_strategy", "sideways");
    expect(readDirectionStrategy()).toBe("auto");
  });
});
