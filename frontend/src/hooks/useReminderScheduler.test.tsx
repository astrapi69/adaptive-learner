/**
 * Tests for useReminderScheduler (#723): on mount it evaluates the
 * reminder slot and, when a review is actually due, shows a notification
 * with the due count, consumes the day's slot, and wires the click to a
 * navigation. It stays silent when disabled or when nothing is due.
 */

import "@testing-library/jest-dom/vitest";
import {renderHook, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react-router-dom")>();
    return {...actual, useNavigate: () => navigate};
});

import type {DueReviewsSummary} from "../lib/notifications/dueReviews";
import type {ReminderNotificationOptions} from "../lib/notifications/showReminderNotification";

const summary = vi.fn<(userId: string) => Promise<DueReviewsSummary>>();
vi.mock("../lib/notifications/dueReviews", () => ({
    getDueReviewsSummary: (userId: string) => summary(userId),
}));

const show = vi.fn<(opts: ReminderNotificationOptions) => boolean>(() => true);
vi.mock("../lib/notifications/showReminderNotification", () => ({
    showReminderNotification: (opts: ReminderNotificationOptions) => show(opts),
}));

vi.mock("../lib/learnerState", () => ({
    readLearnerState: () => ({userId: "u1"}),
}));

import {useReminderScheduler} from "./useReminderScheduler";
import {
    readLastShownDate,
    setReminderTime,
    setRemindersEnabled,
} from "../lib/notifications/reminderPref";
import {localDateKey} from "../lib/notifications/reminder";

function stubGrantedNotification(): void {
    function FakeNotification() {}
    (FakeNotification as unknown as {permission: NotificationPermission}).permission =
        "granted";
    vi.stubGlobal("Notification", FakeNotification);
}

beforeEach(() => {
    localStorage.clear();
    navigate.mockClear();
    summary.mockReset();
    show.mockClear();
    stubGrantedNotification();
    // Make the slot active: enabled, time always in the past, all weekdays.
    setRemindersEnabled(true);
    setReminderTime("00:00");
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("useReminderScheduler", () => {
    it("fires when due, shows the count, consumes the slot, and navigates on click", async () => {
        summary.mockResolvedValue({count: 3, firstSetId: "set-x"});
        renderHook(() => useReminderScheduler());

        await waitFor(() => expect(show).toHaveBeenCalledTimes(1));

        const opts = show.mock.calls[0][0];
        expect(opts.body).toContain("3");
        expect(readLastShownDate()).toBe(localDateKey(new Date()));

        opts.onClick();
        expect(navigate).toHaveBeenCalledWith("/review/set-x");
    });

    it("navigates to the dashboard when no firstSetId is available", async () => {
        summary.mockResolvedValue({count: 2, firstSetId: null});
        renderHook(() => useReminderScheduler());

        await waitFor(() => expect(show).toHaveBeenCalledTimes(1));
        show.mock.calls[0][0].onClick();
        expect(navigate).toHaveBeenCalledWith("/dashboard");
    });

    it("stays silent when reminders are disabled", async () => {
        setRemindersEnabled(false);
        renderHook(() => useReminderScheduler());
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(summary).not.toHaveBeenCalled();
        expect(show).not.toHaveBeenCalled();
    });

    it("does not fire (or consume the slot) when nothing is due", async () => {
        summary.mockResolvedValue({count: 0, firstSetId: null});
        renderHook(() => useReminderScheduler());
        await waitFor(() => expect(summary).toHaveBeenCalled());
        expect(show).not.toHaveBeenCalled();
        expect(readLastShownDate()).toBeNull();
    });
});
