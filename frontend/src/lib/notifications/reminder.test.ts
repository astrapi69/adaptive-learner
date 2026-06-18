/**
 * Tests for the pure reminder scheduling logic (#723):
 * ``isReminderDue`` (due / not-due across enabled, weekday, time,
 * already-shown) and ``localDateKey``.
 */

import {describe, expect, it} from "vitest";

import {isReminderDue, localDateKey} from "./reminder";
import type {ReminderSettings} from "./reminderPref";

function settings(overrides: Partial<ReminderSettings> = {}): ReminderSettings {
    return {
        enabled: true,
        time: "19:00",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        ...overrides,
    };
}

// 2024-01-08 is a Monday (getDay() === 1).
const MONDAY_1930 = new Date(2024, 0, 8, 19, 30);
const MONDAY_1800 = new Date(2024, 0, 8, 18, 0);

describe("localDateKey", () => {
    it("formats the LOCAL calendar day as YYYY-MM-DD", () => {
        expect(localDateKey(MONDAY_1930)).toBe("2024-01-08");
        expect(localDateKey(new Date(2024, 8, 3, 0, 5))).toBe("2024-09-03");
    });
});

describe("isReminderDue", () => {
    it("is due when enabled, weekday matches, time passed, not shown today", () => {
        expect(isReminderDue(settings(), MONDAY_1930, null)).toBe(true);
        expect(isReminderDue(settings(), MONDAY_1930, "2024-01-07")).toBe(true);
    });

    it("is not due when reminders are disabled", () => {
        expect(isReminderDue(settings({enabled: false}), MONDAY_1930, null)).toBe(
            false,
        );
    });

    it("is not due when today's weekday is excluded", () => {
        // Monday is getDay() 1; exclude it.
        expect(
            isReminderDue(settings({weekdays: [0, 6]}), MONDAY_1930, null),
        ).toBe(false);
    });

    it("is not due before the configured time of day", () => {
        expect(isReminderDue(settings(), MONDAY_1800, null)).toBe(false);
    });

    it("is due exactly at the configured minute", () => {
        expect(isReminderDue(settings(), new Date(2024, 0, 8, 19, 0), null)).toBe(
            true,
        );
    });

    it("is not due again once it was shown today", () => {
        expect(isReminderDue(settings(), MONDAY_1930, "2024-01-08")).toBe(false);
    });

    it("is not due when the time string is malformed", () => {
        expect(isReminderDue(settings({time: "nope"}), MONDAY_1930, null)).toBe(
            false,
        );
    });
});
