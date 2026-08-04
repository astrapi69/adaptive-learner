/**
 * #2343 — the nav model's own shape is pinned here, against LITERAL
 * expectations, not against itself.
 *
 * The parity suite (``Navigation.viewport.test.tsx``) derives both nav
 * variants from ``NAV_TARGETS`` and compares them to each other — so it
 * catches a renderer that disagrees with the model, but NOT a model that is
 * empty, reordered, or wrong (both sides of every comparison came from the
 * same constant). These tests assert against a hand-written table instead, so
 * an empty / reordered / mis-grouped / mis-labelled model fails loudly here.
 *
 * This is ``quality-checks.md`` point 4/5: a gate over a set must pin the set
 * itself, and the pin must mean the same thing regardless of the source it is
 * generated from.
 */

import { describe, expect, it } from "vitest";

import { HELP_TARGET, NAV_GROUPS, NAV_TARGETS, navTargetsByGroup } from "./nav-targets";

/**
 * The full expected model, written by hand (NOT derived from NAV_TARGETS).
 * Order is the render order (group order LEARN, CONTENT, PROGRESS, then the
 * flat utility entry). Editing NAV_TARGETS without editing this table is the
 * point — the divergence must surface as a failing test, not as silent green.
 */
const EXPECTED_MODEL = [
  { to: "/dashboard", group: "learn", testId: "nav-dashboard", labelKey: "nav.dashboard" },
  {
    to: "/learning-path",
    group: "learn",
    testId: "nav-learning-path",
    labelKey: "nav.learning_path",
  },
  { to: "/session", group: "learn", testId: "nav-session", labelKey: "nav.session" },
  { to: "/content", group: "content", testId: "nav-content", labelKey: "nav.tab.content" },
  { to: "/progress", group: "progress", testId: "nav-progress", labelKey: "nav.progress" },
  { to: "/settings", group: "utility", testId: "nav-settings", labelKey: "nav.settings" },
] as const;

/** The declared group ids a target may belong to (``utility`` renders flat). */
const VALID_GROUP_IDS = new Set<string>([...NAV_GROUPS.map((group) => group.id), "utility"]);

describe("#2343 NAV_TARGETS model shape (non-vacuity + integrity)", () => {
  it("is non-empty (an empty model must never read as valid)", () => {
    expect(NAV_TARGETS.length).toBeGreaterThan(0);
  });

  it("has exactly the expected number of targets (literal count)", () => {
    // A literal count so adding/removing a target is a deliberate edit here,
    // not a silent change that the self-referential parity check would miss.
    expect(NAV_TARGETS.length).toBe(EXPECTED_MODEL.length);
    expect(NAV_TARGETS.length).toBe(6);
  });

  it("matches the expected model exactly (route, group, testId, label, order)", () => {
    const actual = NAV_TARGETS.map((target) => ({
      to: target.to,
      group: target.group,
      testId: target.testId,
      labelKey: target.labelKey,
    }));
    expect(actual).toEqual(EXPECTED_MODEL.map((entry) => ({ ...entry })));
  });

  it("has unique routes (no duplicate `to`)", () => {
    const routes = NAV_TARGETS.map((target) => target.to);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("has unique test ids (no duplicate `testId`, Help included)", () => {
    const testIds = [...NAV_TARGETS.map((target) => target.testId), HELP_TARGET.testId];
    expect(new Set(testIds).size).toBe(testIds.length);
  });

  it("assigns every target to a declared group id", () => {
    for (const target of NAV_TARGETS) {
      expect(VALID_GROUP_IDS.has(target.group)).toBe(true);
    }
  });

  it("gives every target a non-empty route, label key and fallback", () => {
    for (const target of NAV_TARGETS) {
      expect(target.to.length).toBeGreaterThan(0);
      expect(target.labelKey.length).toBeGreaterThan(0);
      expect(target.labelFallback.length).toBeGreaterThan(0);
    }
  });

  it("navTargetsByGroup partitions the model without loss", () => {
    const grouped = [...VALID_GROUP_IDS].flatMap((id) =>
      navTargetsByGroup(id as (typeof NAV_TARGETS)[number]["group"]).map((target) => target.to),
    );
    expect(grouped.sort()).toEqual(NAV_TARGETS.map((target) => target.to).sort());
  });
});
