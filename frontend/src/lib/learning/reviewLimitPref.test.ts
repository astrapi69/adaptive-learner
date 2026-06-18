/**
 * #718 — review-session length preference.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_REVIEW_LIMIT_PREF,
  readReviewLimit,
  REVIEW_LIMIT_OPTIONS,
  writeReviewLimit,
  REVIEW_LIMIT_PREF_KEY,
} from "./reviewLimitPref";

afterEach(() => localStorage.clear());

describe("reviewLimitPref", () => {
  it("defaults to 10 when unset", () => {
    expect(readReviewLimit()).toBe(10);
    expect(DEFAULT_REVIEW_LIMIT_PREF).toBe(10);
  });

  it("offers exactly 5 / 10 / 15 / 20", () => {
    expect([...REVIEW_LIMIT_OPTIONS]).toEqual([5, 10, 15, 20]);
  });

  it("round-trips an allowed value", () => {
    writeReviewLimit(15);
    expect(readReviewLimit()).toBe(15);
  });

  it("ignores a non-allowed value on write", () => {
    writeReviewLimit(15);
    writeReviewLimit(7);
    expect(readReviewLimit()).toBe(15);
  });

  it("falls back to the default for an invalid stored value", () => {
    localStorage.setItem(REVIEW_LIMIT_PREF_KEY, "999");
    expect(readReviewLimit()).toBe(DEFAULT_REVIEW_LIMIT_PREF);
    localStorage.setItem(REVIEW_LIMIT_PREF_KEY, "not-a-number");
    expect(readReviewLimit()).toBe(DEFAULT_REVIEW_LIMIT_PREF);
  });
});
