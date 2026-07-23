/**
 * Tests for the orphan-cleanup planners (#1445 Parts B + C). Numbers must be
 * exact + isolated (other repos untouched); cards dedup across SRS directions.
 */

import { describe, expect, it } from "vitest";

import {
  distinctCardCount,
  isEmptyPlan,
  planOrphanCleanup,
  planRepoDataDeletion,
  planSetDataDeletion,
} from "./orphan-cleanup";

const progress = [
  { id: "p1", source: "jane/repo", set_id: "waehrung" },
  { id: "p2", source: "jane/repo", set_id: "waehrung" }, // 2nd lesson, same set
  { id: "p3", source: "astrapi69/adaptive-learner-content", set_id: "psych" },
  { id: "p4", source: "bob/other", set_id: "shared" },
];

// Two SRS directions of the same element = one card.
const cards = [
  { set_id: "waehrung", lesson_id: "01", exercise_id: "e1", element_key: "geld" },
  { set_id: "waehrung", lesson_id: "01", exercise_id: "e1", element_key: "geld" },
  { set_id: "waehrung", lesson_id: "01", exercise_id: "e2", element_key: "wert" },
  { set_id: "psych", lesson_id: "01", exercise_id: "e1", element_key: "bias" },
  { set_id: "shared", lesson_id: "01", exercise_id: "e1", element_key: "x" },
];

const sets = [
  { source: "jane/repo", id: "waehrung" },
  { source: "astrapi69/adaptive-learner-content", id: "psych" },
  { source: "bob/other", id: "shared" },
  { source: "someone/else", id: "shared" }, // "shared" also from another repo
];

describe("distinctCardCount", () => {
  it("dedups across SRS directions and restricts to the given set ids", () => {
    expect(distinctCardCount(cards, new Set(["waehrung"]))).toBe(2);
    expect(distinctCardCount(cards, new Set(["psych"]))).toBe(1);
    expect(distinctCardCount(cards, new Set())).toBe(0);
  });
});

describe("planRepoDataDeletion (Part B)", () => {
  it("removes exactly the repo's lessons + its now-orphaned cards", () => {
    const plan = planRepoDataDeletion("jane/repo", progress, cards, sets);
    expect(plan.lessonProgressIds.sort()).toEqual(["p1", "p2"]);
    expect(plan.orphanedSetIds).toEqual(["waehrung"]);
    expect(plan.lessonCount).toBe(2);
    expect(plan.cardCount).toBe(2); // geld + wert, deduped
  });

  it("is isolated — other repos' progress + cards are never in the plan", () => {
    const plan = planRepoDataDeletion("jane/repo", progress, cards, sets);
    expect(plan.lessonProgressIds).not.toContain("p3");
    expect(plan.lessonProgressIds).not.toContain("p4");
    expect(plan.orphanedSetIds).not.toContain("psych");
    expect(plan.orphanedSetIds).not.toContain("shared");
  });

  it("keeps cards for a set id ANOTHER connected repo still provides", () => {
    // Removing bob/other, but "shared" is also provided by someone/else →
    // its cards stay (not orphaned).
    const plan = planRepoDataDeletion("bob/other", progress, cards, sets);
    expect(plan.lessonProgressIds).toEqual(["p4"]); // the lesson still goes
    expect(plan.orphanedSetIds).toEqual([]); // but no cards, id still loadable
    expect(plan.cardCount).toBe(0);
  });
});

describe("planOrphanCleanup (Part C)", () => {
  it("plans every progress row + card whose source is no longer loadable", () => {
    // jane/repo removed from the connected sources → its data is orphaned.
    const remaining = sets.filter((s) => s.source !== "jane/repo");
    const plan = planOrphanCleanup(progress, cards, remaining);
    expect(plan.lessonProgressIds.sort()).toEqual(["p1", "p2"]);
    expect(plan.orphanedSetIds).toEqual(["waehrung"]);
    expect(plan.lessonCount).toBe(2);
    expect(plan.cardCount).toBe(2);
  });

  it("leaves official + still-connected progress alone", () => {
    const remaining = sets.filter((s) => s.source !== "jane/repo");
    const plan = planOrphanCleanup(progress, cards, remaining);
    expect(plan.lessonProgressIds).not.toContain("p3"); // official
    expect(plan.lessonProgressIds).not.toContain("p4"); // bob/other still there
  });

  it("returns an empty plan when nothing is orphaned", () => {
    const plan = planOrphanCleanup(progress, cards, sets);
    expect(isEmptyPlan(plan)).toBe(true);
    expect(plan.lessonProgressIds).toEqual([]);
    expect(plan.orphanedSetIds).toEqual([]);
  });
});

describe("planSetDataDeletion - single-set delete cleanup (#1819)", () => {
  const progress = [
    { id: "lp-1", source: "jane/repo", set_id: "waehrung" },
    { id: "lp-2", source: "jane/repo", set_id: "waehrung" },
    { id: "lp-3", source: "jane/repo", set_id: "other-set" },
    { id: "lp-4", source: "user-generated", set_id: "waehrung" },
  ];
  const cards = [
    { set_id: "waehrung", lesson_id: "01", exercise_id: "e1", element_key: "geld" },
    { set_id: "waehrung", lesson_id: "01", exercise_id: "e1", element_key: "geld" },
    { set_id: "other-set", lesson_id: "01", exercise_id: "e1", element_key: "zeit" },
  ];

  it("plans exactly the set's progress rows + its cards", () => {
    const plan = planSetDataDeletion("jane/repo", "waehrung", progress, cards, [
      { source: "jane/repo", id: "waehrung" },
    ]);
    expect(plan.lessonProgressIds).toEqual(["lp-1", "lp-2"]);
    expect(plan.orphanedSetIds).toEqual(["waehrung"]);
    expect(plan.lessonCount).toBe(2);
    expect(plan.cardCount).toBe(1);
  });

  it("keeps cards when ANOTHER source still provides the same set id", () => {
    const plan = planSetDataDeletion("jane/repo", "waehrung", progress, cards, [
      { source: "jane/repo", id: "waehrung" },
      { source: "other/repo", id: "waehrung" },
    ]);
    expect(plan.lessonProgressIds).toEqual(["lp-1", "lp-2"]);
    expect(plan.orphanedSetIds).toEqual([]);
    expect(plan.cardCount).toBe(0);
  });

  it("returns an empty plan when the set has no learner data", () => {
    const plan = planSetDataDeletion("jane/repo", "untouched", progress, cards, [
      { source: "jane/repo", id: "untouched" },
    ]);
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it("never plans another source's rows for the same set id", () => {
    const plan = planSetDataDeletion("jane/repo", "waehrung", progress, cards, [
      { source: "jane/repo", id: "waehrung" },
    ]);
    expect(plan.lessonProgressIds).not.toContain("lp-4");
  });
});
