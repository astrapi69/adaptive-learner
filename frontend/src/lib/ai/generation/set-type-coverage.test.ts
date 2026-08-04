/**
 * #2356 — tests for set-wide exercise-type coverage.
 */

import { describe, expect, it } from "vitest";

import {
  distinctExerciseTypes,
  setTypeCoverage,
  SET_TYPE_TARGET,
} from "./set-type-coverage";

describe("distinctExerciseTypes", () => {
  it("returns distinct types in first-seen order", () => {
    const types = distinctExerciseTypes([
      { type: "cloze" },
      { type: "matching" },
      { type: "cloze" },
      { type: "free_text" },
    ]);
    expect(types).toEqual(["cloze", "matching", "free_text"]);
  });

  it("is empty for no exercises", () => {
    expect(distinctExerciseTypes([])).toEqual([]);
  });
});

describe("setTypeCoverage", () => {
  it("flattens across lessons and clears the target only above four types", () => {
    // The exact real-world failure: four types across the whole set.
    const fourTypeSet = [
      [{ type: "cloze" }, { type: "matching" }],
      [{ type: "free_text" }, { type: "word_tiles" }],
      [{ type: "cloze" }, { type: "matching" }],
    ];
    const coverage = setTypeCoverage(fourTypeSet);
    expect(coverage.count).toBe(4);
    expect(coverage.meetsTarget).toBe(false);
  });

  it("reports meetsTarget once the set carries more than four distinct types", () => {
    const richSet = [
      [{ type: "cloze" }, { type: "matching" }],
      [{ type: "free_text" }, { type: "multiple_choice" }],
      [{ type: "word_tiles" }, { type: "ext:al-categorization" }],
    ];
    const coverage = setTypeCoverage(richSet);
    expect(coverage.count).toBeGreaterThan(SET_TYPE_TARGET);
    expect(coverage.meetsTarget).toBe(true);
    expect(coverage.types).toContain("ext:al-categorization");
  });
});
