/** Tests for the set-scoped lesson exit target (#2811). */

import {describe, expect, it} from "vitest";

import {exitRouteForLesson} from "./continue-learning";

describe("exitRouteForLesson", () => {
  it("returns the set page when the lesson belongs to a set", () => {
    expect(exitRouteForLesson("es-a1")).toBe("/content/set/es-a1");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["blank space", "   "],
  ])("falls back to the content tab for %s", (_label, value) => {
    expect(exitRouteForLesson(value as string | null)).toBe("/content?tab=my");
  });

  it("encodes a set id that needs escaping", () => {
    expect(exitRouteForLesson("a/b c")).toBe("/content/set/a%2Fb%20c");
  });
});
