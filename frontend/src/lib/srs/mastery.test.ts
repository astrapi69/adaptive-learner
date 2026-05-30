/**
 * EXP-018 / Phase 62 — direction-aware mastery helpers.
 */

import {describe, expect, it} from "vitest";

import type {ElementError} from "../../storage/types";
import {isFullyMastered, masteryCounts} from "./mastery";

function err(overrides: Partial<ElementError> = {}): ElementError {
  return {
    id: "id",
    user_id: "u",
    set_id: "s",
    lesson_id: "l",
    exercise_id: "e",
    element_key: "merci",
    direction: "target_to_source",
    element_type: "vocabulary",
    user_answer: "",
    correct_answer: "Merci",
    error_count: 0,
    correct_streak: 3,
    last_error_at: null,
    last_attempt_at: "2026-05-30T00:00:00Z",
    mastered: true,
    mastered_at: "2026-05-30T00:00:00Z",
    created_at: "2026-05-30T00:00:00Z",
    updated_at: "2026-05-30T00:00:00Z",
    ...overrides,
  };
}

describe("isFullyMastered", () => {
  it("is false with only the receptive direction mastered", () => {
    expect(isFullyMastered([err({direction: "target_to_source"})])).toBe(false);
  });

  it("is false with only the productive direction mastered", () => {
    expect(isFullyMastered([err({direction: "source_to_target"})])).toBe(false);
  });

  it("is true when both directions are mastered", () => {
    expect(
      isFullyMastered([
        err({direction: "target_to_source", mastered: true}),
        err({direction: "source_to_target", mastered: true}),
      ]),
    ).toBe(true);
  });

  it("is false when productive exists but is not mastered", () => {
    expect(
      isFullyMastered([
        err({direction: "target_to_source", mastered: true}),
        err({direction: "source_to_target", mastered: false}),
      ]),
    ).toBe(false);
  });
});

describe("masteryCounts", () => {
  it("splits mastered rows by direction and counts fully-mastered elements", () => {
    const rows: ElementError[] = [
      // element A — both directions mastered → fully
      err({element_key: "a", direction: "target_to_source", mastered: true}),
      err({element_key: "a", direction: "source_to_target", mastered: true}),
      // element B — receptive only
      err({element_key: "b", direction: "target_to_source", mastered: true}),
      err({element_key: "b", direction: "source_to_target", mastered: false}),
      // element C — productive only
      err({element_key: "c", direction: "source_to_target", mastered: true}),
    ];
    const counts = masteryCounts(rows);
    expect(counts.receptive).toBe(2); // a, b
    expect(counts.productive).toBe(2); // a, c
    expect(counts.fully).toBe(1); // a only
  });

  it("returns zeros for an empty list", () => {
    expect(masteryCounts([])).toEqual({receptive: 0, productive: 0, fully: 0});
  });
});
