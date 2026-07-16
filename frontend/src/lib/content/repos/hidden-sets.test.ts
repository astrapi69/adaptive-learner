/**
 * Tests for the app-side hidden-set blocklist (#1702).
 *
 * The graded-quiz demo in ``adaptive-learner-content-test`` is a technical
 * conformance fixture that must be hidden from learners (Discover + My
 * Content) but kept on disk in the content repo.
 */

import { describe, expect, it } from "vitest";

import { hiddenSetKey, isHiddenSet } from "./hidden-sets";

const HIDDEN_SOURCE = "astrapi69/adaptive-learner-content-test";
const HIDDEN_ID = "graded-quiz-demo-from-de";

describe("isHiddenSet (#1702)", () => {
  it("hides the graded-quiz-demo fixture from content-test", () => {
    expect(isHiddenSet(HIDDEN_SOURCE, HIDDEN_ID)).toBe(true);
  });

  it("does not hide a real set in the same repo", () => {
    expect(isHiddenSet(HIDDEN_SOURCE, "de-fr-a1")).toBe(false);
  });

  it("does not hide a set with the same id from a different repo", () => {
    // The key is source-scoped: only content-test's fixture is hidden, not a
    // coincidentally same-named set elsewhere.
    expect(isHiddenSet("someone/other-repo", HIDDEN_ID)).toBe(false);
  });

  it("does not hide bundled or official content", () => {
    expect(isHiddenSet("bundled:adaptive-learner-content", "fr-a1-from-en")).toBe(
      false,
    );
    expect(
      isHiddenSet("astrapi69/adaptive-learner-content", "fr-a1-from-en"),
    ).toBe(false);
  });

  it("does not hide on empty source/id", () => {
    expect(isHiddenSet("", "")).toBe(false);
    expect(isHiddenSet(HIDDEN_SOURCE, "")).toBe(false);
    expect(isHiddenSet("", HIDDEN_ID)).toBe(false);
  });

  it("hiddenSetKey composes source::id", () => {
    expect(hiddenSetKey(HIDDEN_SOURCE, HIDDEN_ID)).toBe(
      `${HIDDEN_SOURCE}::${HIDDEN_ID}`,
    );
  });
});
