/**
 * summarySectionsPref (#1411) — the ONE settings object for the
 * lesson-summary sections: defaults, round-trip persistence, robustness
 * against garbage, and the read-side migration of the #1376 single-key
 * correction-round preference (a stored OFF choice must survive the move
 * without a silent reset).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SUMMARY_SECTION_KEYS,
  SUMMARY_SECTIONS_CHANGE_EVENT,
  defaultSummarySections,
  readSummarySections,
  setSummarySectionEnabled,
  writeSummarySections,
} from "./summarySectionsPref";

afterEach(() => {
  localStorage.clear();
});

describe("summarySectionsPref", () => {
  it("defaults to every section ON", () => {
    const sections = readSummarySections();
    for (const key of SUMMARY_SECTION_KEYS) {
      expect(sections[key], key).toBe(true);
    }
  });

  it("persists a full object round-trip (survives a fresh read = reload)", () => {
    const sections = defaultSummarySections();
    sections.xp = false;
    sections.share = false;
    writeSummarySections(sections);
    // A fresh read models a page reload (localStorage is the persistence).
    expect(readSummarySections()).toEqual(sections);
  });

  it("setSummarySectionEnabled flips one flag and keeps the others", () => {
    setSummarySectionEnabled("answers", false);
    setSummarySectionEnabled("result", false);
    const sections = readSummarySections();
    expect(sections.answers).toBe(false);
    expect(sections.result).toBe(false);
    expect(sections.xp).toBe(true);
    expect(sections.correction).toBe(true);
  });

  it("falls back to all-ON on unreadable garbage", () => {
    localStorage.setItem(
      "adaptive-learner.lesson.summary_sections",
      "not json {",
    );
    expect(readSummarySections()).toEqual(defaultSummarySections());
  });

  it("treats missing / non-boolean flags as ON and ignores unknown keys", () => {
    localStorage.setItem(
      "adaptive-learner.lesson.summary_sections",
      JSON.stringify({ xp: false, correction: "nope", bogus: false }),
    );
    const sections = readSummarySections();
    expect(sections.xp).toBe(false);
    expect(sections.correction).toBe(true);
    expect(sections.result).toBe(true);
    expect("bogus" in sections).toBe(false);
  });

  it("migrates the stored #1376 correction-round OFF choice (no silent reset)", () => {
    localStorage.setItem(
      "adaptive-learner.lesson.correction_round_enabled",
      "false",
    );
    const sections = readSummarySections();
    expect(sections.correction).toBe(false);
    // Every other section stays at its default.
    expect(sections.result).toBe(true);
    expect(sections.next_steps).toBe(true);
  });

  it("migrates a stored #1376 ON choice too, and survives the first write", () => {
    localStorage.setItem(
      "adaptive-learner.lesson.correction_round_enabled",
      "false",
    );
    // First write of the new object (e.g. the user toggles another section):
    // the migrated correction choice must be carried over, not reset.
    setSummarySectionEnabled("xp", false);
    const sections = readSummarySections();
    expect(sections.correction).toBe(false);
    expect(sections.xp).toBe(false);
  });

  it("the written object wins over the legacy key", () => {
    localStorage.setItem(
      "adaptive-learner.lesson.correction_round_enabled",
      "false",
    );
    const sections = defaultSummarySections();
    writeSummarySections(sections);
    expect(readSummarySections().correction).toBe(true);
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
