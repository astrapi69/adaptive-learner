/** Tests for the user-facing hidden-set blocklist (Graded-Quiz Demo). */

import { describe, expect, it } from "vitest";

import { isHiddenSet } from "./hidden-sets";

describe("isHiddenSet", () => {
  it("hides the graded-quiz-demo reference set in the test repo", () => {
    expect(
      isHiddenSet("astrapi69/adaptive-learner-content-test", "graded-quiz-demo-from-de"),
    ).toBe(true);
  });

  it("does not hide other sets in the same test repo", () => {
    expect(
      isHiddenSet("astrapi69/adaptive-learner-content-test", "react-grundlagen-from-de"),
    ).toBe(false);
  });

  it("does not hide a same-id set from a different repo (source-scoped)", () => {
    expect(
      isHiddenSet("someone/other-repo", "graded-quiz-demo-from-de"),
    ).toBe(false);
  });

  it("does not hide official content", () => {
    expect(isHiddenSet("astrapi69/adaptive-learner-content", "de-a1-from-en")).toBe(false);
  });
});
