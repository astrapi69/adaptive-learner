/**
 * #3499 - a review started from a lesson carries the lesson path as
 * ``?from=``; only a lesson route is accepted back, so the parameter can
 * never send the learner off-app.
 */

import { describe, expect, it } from "vitest";

import { readReviewOrigin, reviewHref } from "./review-origin";

describe("reviewHref (#3499)", () => {
  it("links to the review of the set without an origin", () => {
    expect(reviewHref("fr a1")).toBe("/review/fr%20a1");
  });

  it("carries the lesson path as an encoded from parameter", () => {
    expect(reviewHref("fr-a1", "/lesson/fr/fr-a1/01.json")).toBe(
      "/review/fr-a1?from=%2Flesson%2Ffr%2Ffr-a1%2F01.json",
    );
  });
});

describe("readReviewOrigin (#3499)", () => {
  it.each([
    ["a lesson path", "/lesson/fr/fr-a1/01.json", "/lesson/fr/fr-a1/01.json"],
    ["no parameter", null, null],
    ["an empty value", "", null],
    ["another in-app page", "/dashboard", null],
    ["a protocol-relative URL", "//evil.example/lesson/x", null],
    ["an absolute URL", "https://evil.example/lesson/x", null],
    ["a backslash trick", "/lesson/\\evil.example", null],
    ["the bare prefix", "/lesson/", null],
  ])("%s -> %s", (_name, raw, expected) => {
    expect(readReviewOrigin(raw)).toBe(expected);
  });
});
