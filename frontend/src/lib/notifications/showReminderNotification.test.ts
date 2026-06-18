/**
 * Tests for showReminderNotification (#723): unsupported / not-granted
 * short-circuits, and the granted path including click → onClick + focus.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {showReminderNotification} from "./showReminderNotification";

interface FakeInstance {
    title: string;
    options: NotificationOptions | undefined;
    onclick: (() => void) | null;
    close: () => void;
}

const instances: FakeInstance[] = [];

function makeFakeNotification(permission: NotificationPermission) {
    function FakeNotification(
        this: FakeInstance,
        title: string,
        options?: NotificationOptions,
    ) {
        this.title = title;
        this.options = options;
        this.onclick = null;
        this.close = vi.fn();
        instances.push(this);
    }
    (FakeNotification as unknown as {permission: NotificationPermission}).permission =
        permission;
    return FakeNotification;
}

beforeEach(() => {
    instances.length = 0;
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("showReminderNotification", () => {
    it("returns false when the Notifications API is absent", () => {
        vi.stubGlobal("Notification", undefined);
        const onClick = vi.fn();
        expect(
            showReminderNotification({title: "t", body: "b", onClick}),
        ).toBe(false);
        expect(onClick).not.toHaveBeenCalled();
    });

    it("returns false when permission is not granted", () => {
        vi.stubGlobal("Notification", makeFakeNotification("denied"));
        const onClick = vi.fn();
        expect(
            showReminderNotification({title: "t", body: "b", onClick}),
        ).toBe(false);
        expect(instances).toHaveLength(0);
    });

    it("shows the notification when granted and wires click → focus + onClick", () => {
        vi.stubGlobal("Notification", makeFakeNotification("granted"));
        const focus = vi.spyOn(window, "focus").mockImplementation(() => {});
        const onClick = vi.fn();

        const shown = showReminderNotification({
            title: "Time to review",
            body: "3 reviews are due.",
            onClick,
        });

        expect(shown).toBe(true);
        expect(instances).toHaveLength(1);
        expect(instances[0].title).toBe("Time to review");
        expect(instances[0].options?.body).toBe("3 reviews are due.");

        // Simulate the user clicking the notification.
        instances[0].onclick?.();
        expect(focus).toHaveBeenCalledTimes(1);
        expect(instances[0].close).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
