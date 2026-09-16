/**
 * summarySectionsPref (#1426, generalises #1411 / #1376) — the ONE ordered
 * settings structure for the lesson-summary sections: default order + the
 * compact default set (#3124: result and XP on, the rest off), round-trip
 * persistence, sanitize robustness (a section missing from a STORED config
 * fills in ON, never the compact default), pure move, and the lossless
 * migration of BOTH predecessors (the #1411 visibility object and the #1376
 * single-key correction preference) with no silent reset.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SUMMARY_SECTION_ORDER,
  SUMMARY_SECTION_KEYS,
  SUMMARY_SECTIONS_CHANGE_EVENT,
  defaultSummarySections,
  isSummarySectionEnabled,
  moveSummarySection,
  readSummarySections,
  sanitizeSummarySections,
  setSummarySectionEnabled,
  writeSummarySections,
  type SummarySectionsConfig,
} from "./summarySectionsPref";

const ORDER_KEY = "adaptive-learner.lesson.summary_sections_order";
const LEGACY_SECTIONS_KEY = "adaptive-learner.lesson.summary_sections";
const LEGACY_CORRECTION_KEY =
  "adaptive-learner.lesson.correction_round_enabled";

/** The section ids in configured (render) order. */
function orderOf(config: SummarySectionsConfig): string[] {
  return config.map((s) => s.id);
}

afterEach(() => {
  localStorage.clear();
});

describe("summarySectionsPref", () => {
  it("defaults to the compact set (result + XP on, the rest off), in today's fixed order (#3124)", () => {
    const config = readSummarySections();
    expect(orderOf(config)).toEqual([...DEFAULT_SUMMARY_SECTION_ORDER]);
    expect(config).toEqual(defaultSummarySections());
    const enabled = Object.fromEntries(config.map((s) => [s.id, s.enabled]));
    expect(enabled).toEqual({
      favorite: false,
      result: true,
      xp: true,
      share: false,
      answers: false,
      export: false,
      explanations: false,
      correction: false,
      next_steps: false,
    });
  });

  it("the default order pins today's top-to-bottom sequence", () => {
    // Regression pin: favorite first, correction right before next_steps
    // (#2570 - between the score sections and the next-step cards, not
    // trailing after them), result second, the #599 mistake review
    // directly above correction (#3124, keeping the #1432 adjacency).
    expect([...DEFAULT_SUMMARY_SECTION_ORDER]).toEqual([
      "favorite",
      "result",
      "xp",
      "share",
      "answers",
      "export",
      "explanations",
      "correction",
      "next_steps",
    ]);
  });

  it("persists a full ordered round-trip (survives a fresh read = reload)", () => {
    const config = moveSummarySection(defaultSummarySections(), "correction", -1);
    config.find((s) => s.id === "xp")!.enabled = false;
    writeSummarySections(config);
    // A fresh read models a page reload (localStorage is the persistence).
    expect(readSummarySections()).toEqual(config);
  });

  it("moveSummarySection is a pure up/down swap, out-of-range = no-op", () => {
    const base = defaultSummarySections();
    const up = moveSummarySection(base, "result", -1);
    expect(orderOf(up).slice(0, 2)).toEqual(["result", "favorite"]);
    // Base is untouched (pure).
    expect(orderOf(base)[0]).toBe("favorite");
    // Already-first up and already-last down are no-ops (same ref).
    expect(moveSummarySection(base, "favorite", -1)).toBe(base);
    expect(moveSummarySection(base, "next_steps", 1)).toBe(base);
  });

  it("a disabled section keeps its ON/OFF state while it moves", () => {
    let config = defaultSummarySections();
    config.find((s) => s.id === "share")!.enabled = false;
    config = moveSummarySection(config, "share", -1);
    const share = config.find((s) => s.id === "share")!;
    expect(share.enabled).toBe(false);
    expect(orderOf(config).indexOf("share")).toBeLessThan(
      orderOf(defaultSummarySections()).indexOf("share"),
    );
  });

  it("setSummarySectionEnabled flips one flag, keeping order and others", () => {
    setSummarySectionEnabled("answers", true);
    setSummarySectionEnabled("result", false);
    const config = readSummarySections();
    expect(isSummarySectionEnabled(config, "answers")).toBe(true);
    expect(isSummarySectionEnabled(config, "result")).toBe(false);
    expect(isSummarySectionEnabled(config, "xp")).toBe(true);
    expect(isSummarySectionEnabled(config, "correction")).toBe(false);
    // Order stays the default — toggling never reorders.
    expect(orderOf(config)).toEqual([...DEFAULT_SUMMARY_SECTION_ORDER]);
  });

  it("sanitize: falls back to the full default on non-array / garbage", () => {
    expect(sanitizeSummarySections("not an array")).toEqual(
      defaultSummarySections(),
    );
    expect(sanitizeSummarySections(null)).toEqual(defaultSummarySections());
    localStorage.setItem(ORDER_KEY, "not json {");
    expect(readSummarySections()).toEqual(defaultSummarySections());
  });

  it("sanitize: drops unknown ids and fills missing known sections in ON, not at the compact default", () => {
    const cleaned = sanitizeSummarySections([
      { id: "correction", enabled: false },
      { id: "bogus", enabled: true },
      { id: "correction", enabled: true }, // duplicate → ignored
      { id: "xp", enabled: "nope" }, // non-boolean → ON
    ]);
    // Stored known ids keep their order first (the mistake review slots in
    // before its correction anchor, see below), then the rest of the known
    // set at the end.
    expect(orderOf(cleaned).slice(0, 3)).toEqual(["explanations", "correction", "xp"]);
    expect(cleaned.find((s) => s.id === "correction")!.enabled).toBe(false);
    expect(cleaned.find((s) => s.id === "xp")!.enabled).toBe(true);
    // A section the stored config did not carry was ON when it was written
    // (#3124: no silent reset to the compact default for stored state).
    for (const id of ["favorite", "share", "answers", "export", "explanations", "next_steps"] as const) {
      expect(cleaned.find((s) => s.id === id)!.enabled, id).toBe(true);
    }
    // Every known section is present exactly once, none unknown.
    expect(orderOf(cleaned).sort()).toEqual([...SUMMARY_SECTION_KEYS].sort());
    expect(orderOf(cleaned)).not.toContain("bogus");
  });

  it("sanitize: a pre-#3124 full config gains the mistake review directly above the correction round, ON", () => {
    // The eight-entry shape every learner stored before #3124, in a custom
    // order with correction moved to the front.
    const stored = [
      { id: "correction", enabled: true },
      { id: "result", enabled: true },
      { id: "xp", enabled: false },
      { id: "favorite", enabled: true },
      { id: "share", enabled: true },
      { id: "answers", enabled: true },
      { id: "export", enabled: true },
      { id: "next_steps", enabled: true },
    ];
    const cleaned = sanitizeSummarySections(stored);
    expect(orderOf(cleaned)).toEqual([
      "explanations",
      "correction",
      "result",
      "xp",
      "favorite",
      "share",
      "answers",
      "export",
      "next_steps",
    ]);
    expect(isSummarySectionEnabled(cleaned, "explanations")).toBe(true);
    // Stored flags untouched.
    expect(isSummarySectionEnabled(cleaned, "xp")).toBe(false);
  });

  it("sanitize: without a stored correction entry the missing sections follow in the default order", () => {
    const cleaned = sanitizeSummarySections([{ id: "result", enabled: true }]);
    expect(orderOf(cleaned)).toEqual([
      "result",
      "favorite",
      "xp",
      "share",
      "answers",
      "export",
      "explanations",
      "correction",
      "next_steps",
    ]);
  });

  it("isSummarySectionEnabled treats a missing entry as ON", () => {
    expect(isSummarySectionEnabled([], "favorite")).toBe(true);
    expect(isSummarySectionEnabled([{ id: "favorite", enabled: false }], "favorite")).toBe(false);
  });

  it("migrates the #1411 visibility object losslessly into the default order", () => {
    // A stored #1411 object with two sections OFF, order key never written.
    localStorage.setItem(
      LEGACY_SECTIONS_KEY,
      JSON.stringify({ xp: false, share: false, bogus: false }),
    );
    const config = readSummarySections();
    // Visibility preserved exactly.
    expect(isSummarySectionEnabled(config, "xp")).toBe(false);
    expect(isSummarySectionEnabled(config, "share")).toBe(false);
    expect(isSummarySectionEnabled(config, "result")).toBe(true);
    // Sections the #1411 object never stored were ON for that learner, so
    // they stay ON - not the #3124 compact default.
    for (const id of ["favorite", "answers", "export", "explanations", "correction", "next_steps"] as const) {
      expect(isSummarySectionEnabled(config, id), id).toBe(true);
    }
    // Order starts at the default (no reorder implied by a visibility-only
    // predecessor).
    expect(orderOf(config)).toEqual([...DEFAULT_SUMMARY_SECTION_ORDER]);
  });

  it("migrates the stored #1376 correction OFF choice (no silent reset)", () => {
    localStorage.setItem(LEGACY_CORRECTION_KEY, "false");
    const config = readSummarySections();
    expect(isSummarySectionEnabled(config, "correction")).toBe(false);
    // Every other section stays at the ON that learner saw (#3124: the
    // compact default is for fresh installs only).
    expect(isSummarySectionEnabled(config, "result")).toBe(true);
    expect(isSummarySectionEnabled(config, "next_steps")).toBe(true);
    expect(isSummarySectionEnabled(config, "favorite")).toBe(true);
    expect(orderOf(config)).toEqual([...DEFAULT_SUMMARY_SECTION_ORDER]);
  });

  it("carries a migrated choice through the first ordered write (no reset)", () => {
    localStorage.setItem(LEGACY_CORRECTION_KEY, "false");
    // First write of the new ordered key (e.g. the user toggles another
    // section): the migrated correction choice must be carried over.
    setSummarySectionEnabled("xp", false);
    const config = readSummarySections();
    expect(isSummarySectionEnabled(config, "correction")).toBe(false);
    expect(isSummarySectionEnabled(config, "xp")).toBe(false);
  });

  it("the written ordered key wins over both legacy keys", () => {
    localStorage.setItem(LEGACY_CORRECTION_KEY, "false");
    localStorage.setItem(
      LEGACY_SECTIONS_KEY,
      JSON.stringify({ result: false }),
    );
    writeSummarySections(
      defaultSummarySections().map((section) => ({ ...section, enabled: true })),
    );
    const config = readSummarySections();
    expect(isSummarySectionEnabled(config, "correction")).toBe(true);
    expect(isSummarySectionEnabled(config, "result")).toBe(true);
  });

  it("dispatches the change event on write", () => {
    const listener = vi.fn();
    window.addEventListener(SUMMARY_SECTIONS_CHANGE_EVENT, listener);
    try {
      setSummarySectionEnabled("share", false);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(SUMMARY_SECTIONS_CHANGE_EVENT, listener);
    }
  });
});
