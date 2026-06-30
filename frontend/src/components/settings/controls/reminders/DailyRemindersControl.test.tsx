/**
 * Tests for DailyRemindersControl (#723): default off state, enabling
 * persists + enables the controls, the permission request button (default
 * permission), the denied + unsupported guidance, and weekday toggling.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import DailyRemindersControl from "./DailyRemindersControl";
import {
    readReminderSettings,
    setRemindersEnabled,
} from "../../../../lib/notifications/reminderPref";

const requestPermission = vi.fn().mockResolvedValue("granted");

function stubNotification(permission: NotificationPermission): void {
    function FakeNotification() {}
    (FakeNotification as unknown as {permission: NotificationPermission}).permission =
        permission;
    (
        FakeNotification as unknown as {requestPermission: typeof requestPermission}
    ).requestPermission = requestPermission;
    vi.stubGlobal("Notification", FakeNotification);
}

beforeEach(() => {
    localStorage.clear();
    requestPermission.mockClear();
    stubNotification("default");
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("DailyRemindersControl", () => {
    it("is off by default and disables the time + weekday controls", () => {
        render(<DailyRemindersControl />);
        expect(screen.getByTestId("settings-reminders-toggle")).not.toBeChecked();
        expect(screen.getByTestId("settings-reminders-time")).toBeDisabled();
        expect(screen.getByTestId("settings-reminders-weekday-1")).toBeDisabled();
    });

    it("enabling persists the setting and enables the controls", () => {
        render(<DailyRemindersControl />);
        fireEvent.click(screen.getByTestId("settings-reminders-toggle"));
        expect(readReminderSettings().enabled).toBe(true);
        expect(screen.getByTestId("settings-reminders-time")).toBeEnabled();
        expect(screen.getByTestId("settings-reminders-weekday-1")).toBeEnabled();
    });

    it("offers the permission request button when enabled and permission is default", () => {
        setRemindersEnabled(true);
        render(<DailyRemindersControl />);
        const button = screen.getByTestId("settings-reminders-request");
        expect(button).toBeInTheDocument();
        fireEvent.click(button);
        expect(requestPermission).toHaveBeenCalled();
    });

    it("shows denied guidance when permission is denied", () => {
        setRemindersEnabled(true);
        stubNotification("denied");
        render(<DailyRemindersControl />);
        expect(screen.getByTestId("settings-reminders-denied")).toBeInTheDocument();
        expect(
            screen.queryByTestId("settings-reminders-request"),
        ).not.toBeInTheDocument();
    });

    it("shows unsupported guidance when the Notifications API is absent", () => {
        setRemindersEnabled(true);
        vi.stubGlobal("Notification", undefined);
        render(<DailyRemindersControl />);
        expect(
            screen.getByTestId("settings-reminders-unsupported"),
        ).toBeInTheDocument();
    });

    it("changing the time persists it", () => {
        setRemindersEnabled(true);
        render(<DailyRemindersControl />);
        fireEvent.change(screen.getByTestId("settings-reminders-time"), {
            target: {value: "08:30"},
        });
        expect(readReminderSettings().time).toBe("08:30");
    });

    it("toggling a weekday off persists the reduced set", () => {
        setRemindersEnabled(true);
        render(<DailyRemindersControl />);
        // Default is all 7 days; clicking Monday (3 -> Wednesday) removes it.
        fireEvent.click(screen.getByTestId("settings-reminders-weekday-3"));
        expect(readReminderSettings().weekdays).toEqual([0, 1, 2, 4, 5, 6]);
    });
});
