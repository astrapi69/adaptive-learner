/**
 * Tests for the desktop update preferences (#840).
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_UPDATE_PREFS,
  isCheckDue,
  readUpdatePrefs,
  writeUpdatePrefs,
  type UpdatePrefs,
} from "./updatePrefs";

beforeEach(() => localStorage.clear());

const DAY = 24 * 60 * 60 * 1000;

describe("update prefs storage", () => {
  it("returns defaults when nothing is stored", () => {
    expect(readUpdatePrefs()).toEqual(DEFAULT_UPDATE_PREFS);
  });

  it("round-trips a written patch", () => {
    writeUpdatePrefs({ check_interval: "weekly", dismissed_version: "1.90.0" });
    const prefs = readUpdatePrefs();
    expect(prefs.check_interval).toBe("weekly");
    expect(prefs.dismissed_version).toBe("1.90.0");
    expect(prefs.auto_check).toBe(true); // untouched default
  });

  it("ignores a malformed interval", () => {
    localStorage.setItem(
      "adaptive-learner.updates",
      JSON.stringify({ check_interval: "hourly" }),
    );
    expect(readUpdatePrefs().check_interval).toBe("daily");
  });
});

describe("isCheckDue", () => {
  const base: UpdatePrefs = {
    auto_check: true,
    check_interval: "weekly",
    last_check_at: null,
    dismissed_version: null,
  };
  const now = Date.parse("2026-06-20T12:00:00Z");

  it("is false when auto-check is off", () => {
    expect(isCheckDue({ ...base, auto_check: false }, now)).toBe(false);
  });

  it("is false for the 'never' interval", () => {
    expect(isCheckDue({ ...base, check_interval: "never", last_check_at: null }, now)).toBe(
      false,
    );
  });

  it("is true when never checked", () => {
    expect(isCheckDue(base, now)).toBe(true);
  });

  it("is false when the weekly interval has not elapsed (3 days)", () => {
    const last = new Date(now - 3 * DAY).toISOString();
    expect(isCheckDue({ ...base, last_check_at: last }, now)).toBe(false);
  });

  it("is true when the weekly interval has elapsed (8 days)", () => {
    const last = new Date(now - 8 * DAY).toISOString();
    expect(isCheckDue({ ...base, last_check_at: last }, now)).toBe(true);
  });
});
