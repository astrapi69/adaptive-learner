/**
 * Tests for reminder preference persistence (#723): defaults, read/write
 * round-trips, and the validation/clamp helpers.
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    DEFAULT_REMINDER_TIME,
    DEFAULT_REMINDERS_ENABLED,
    clampWeekdays,
    isValidTime,
    readLastShownDate,
    readReminderSettings,
    setLastShownDate,
    setReminderTime,
    setReminderWeekdays,
    setRemindersEnabled,
} from "./reminderPref";

beforeEach(() => {
    localStorage.clear();
});

describe("isValidTime", () => {
    it("accepts valid 24h HH:MM", () => {
        expect(isValidTime("00:00")).toBe(true);
        expect(isValidTime("19:30")).toBe(true);
        expect(isValidTime("23:59")).toBe(true);
    });
    it("rejects malformed or out-of-range times", () => {
        expect(isValidTime("24:00")).toBe(false);
        expect(isValidTime("19:60")).toBe(false);
        expect(isValidTime("7:30")).toBe(false);
        expect(isValidTime("nope")).toBe(false);
    });
});

describe("clampWeekdays", () => {
    it("dedupes, sorts, and drops out-of-range values", () => {
        expect(clampWeekdays([3, 1, 1, 7, -1, 6])).toEqual([1, 3, 6]);
        expect(clampWeekdays([])).toEqual([]);
    });
});

describe("readReminderSettings", () => {
    it("returns defaults on a clean store", () => {
        const s = readReminderSettings();
        expect(s.enabled).toBe(DEFAULT_REMINDERS_ENABLED);
        expect(s.time).toBe(DEFAULT_REMINDER_TIME);
        expect(s.weekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it("round-trips enabled, time, and weekdays", () => {
        setRemindersEnabled(true);
        setReminderTime("08:15");
        setReminderWeekdays([5, 1, 1, 3]);
        const s = readReminderSettings();
        expect(s.enabled).toBe(true);
        expect(s.time).toBe("08:15");
        expect(s.weekdays).toEqual([1, 3, 5]);
    });

    it("ignores an invalid persisted time and falls back to default", () => {
        localStorage.setItem("adaptive-learner.reminders.time", "99:99");
        expect(readReminderSettings().time).toBe(DEFAULT_REMINDER_TIME);
    });

    it("rejects an invalid time on write", () => {
        setReminderTime("08:00");
        setReminderTime("bad");
        expect(readReminderSettings().time).toBe("08:00");
    });

    it("falls back to all weekdays when none persist as valid", () => {
        setReminderWeekdays([]);
        expect(readReminderSettings().weekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
});

describe("lastShownDate", () => {
    it("is null until set, then round-trips", () => {
        expect(readLastShownDate()).toBeNull();
        setLastShownDate("2024-01-08");
        expect(readLastShownDate()).toBe("2024-01-08");
    });
});
