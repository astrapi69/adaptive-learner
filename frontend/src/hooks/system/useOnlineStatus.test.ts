import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {useOnlineStatus} from "./useOnlineStatus";

describe("useOnlineStatus", () => {
    let originalOnLine: PropertyDescriptor | undefined;

    beforeEach(() => {
        originalOnLine = Object.getOwnPropertyDescriptor(
            window.navigator,
            "onLine",
        );
    });

    afterEach(() => {
        if (originalOnLine) {
            Object.defineProperty(window.navigator, "onLine", originalOnLine);
        }
        vi.restoreAllMocks();
    });

    function setOnline(value: boolean) {
        Object.defineProperty(window.navigator, "onLine", {
            configurable: true,
            value,
        });
    }

    it("initialises from navigator.onLine at mount (true)", () => {
        setOnline(true);
        const {result} = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(true);
    });

    it("initialises from navigator.onLine at mount (false)", () => {
        setOnline(false);
        const {result} = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(false);
    });

    it("flips to false when the 'offline' event fires", () => {
        setOnline(true);
        const {result} = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(true);
        act(() => {
            window.dispatchEvent(new Event("offline"));
        });
        expect(result.current).toBe(false);
    });

    it("flips to true when the 'online' event fires", () => {
        setOnline(false);
        const {result} = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(false);
        act(() => {
            window.dispatchEvent(new Event("online"));
        });
        expect(result.current).toBe(true);
    });

    it("cleans up listeners on unmount", () => {
        setOnline(true);
        const removeSpy = vi.spyOn(window, "removeEventListener");
        const {unmount} = renderHook(() => useOnlineStatus());
        unmount();
        // The hook registered two listeners (online + offline); both
        // must be removed on cleanup.
        const calls = removeSpy.mock.calls.map((c) => c[0]);
        expect(calls).toContain("online");
        expect(calls).toContain("offline");
    });
});
