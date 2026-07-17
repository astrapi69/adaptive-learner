/**
 * Tests for the settings-refresh bus (#1765): subscribe/emit + unsubscribe,
 * so a settings-mutating section can ask the Settings page to re-read.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
    emitSettingsRefresh,
    resetSettingsRefreshBus,
    subscribeSettingsRefresh,
} from "./settings-refresh-bus";

afterEach(() => {
    resetSettingsRefreshBus();
});

describe("settings-refresh-bus", () => {
    it("notifies every subscriber on emit", () => {
        const a = vi.fn();
        const b = vi.fn();
        subscribeSettingsRefresh(a);
        subscribeSettingsRefresh(b);

        emitSettingsRefresh();

        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
    });

    it("stops notifying after unsubscribe", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeSettingsRefresh(listener);

        emitSettingsRefresh();
        unsubscribe();
        emitSettingsRefresh();

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("is a no-op with no subscribers", () => {
        expect(() => emitSettingsRefresh()).not.toThrow();
    });
});
