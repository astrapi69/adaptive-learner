/**
 * correctionRoundPref (#1376) — default-on boolean pref for the lesson-summary
 * correction round, persisted in localStorage.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CORRECTION_ROUND_PREF_CHANGE_EVENT,
  DEFAULT_CORRECTION_ROUND_ENABLED,
  readCorrectionRoundEnabled,
  setCorrectionRoundEnabled,
} from "./correctionRoundPref";

afterEach(() => {
  localStorage.clear();
});

describe("correctionRoundPref", () => {
  it("defaults to ON when nothing is stored", () => {
    expect(DEFAULT_CORRECTION_ROUND_ENABLED).toBe(true);
    expect(readCorrectionRoundEnabled()).toBe(true);
  });

  it("persists a disable and re-reads it (survives a 'reload')", () => {
    setCorrectionRoundEnabled(false);
    expect(readCorrectionRoundEnabled()).toBe(false);
    // Raw stored value is the typed boolean flag, not a magic string.
    expect(
      localStorage.getItem("adaptive-learner.lesson.correction_round_enabled"),
    ).toBe("false");
  });

  it("persists a re-enable", () => {
    setCorrectionRoundEnabled(false);
    setCorrectionRoundEnabled(true);
    expect(readCorrectionRoundEnabled()).toBe(true);
  });

  it("falls back to the default on a garbage stored value", () => {
    localStorage.setItem(
      "adaptive-learner.lesson.correction_round_enabled",
      "maybe",
    );
    expect(readCorrectionRoundEnabled()).toBe(true);
  });

  it("notifies same-tab listeners on change", () => {
    const listener = vi.fn();
    window.addEventListener(CORRECTION_ROUND_PREF_CHANGE_EVENT, listener);
    setCorrectionRoundEnabled(false);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(CORRECTION_ROUND_PREF_CHANGE_EVENT, listener);
  });
});
