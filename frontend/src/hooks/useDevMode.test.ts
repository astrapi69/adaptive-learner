/**
 * Tests for the useDevMode hook
 * (DEV-MODE-FRIENDLY-ERRORS-01).
 *
 * Pins:
 *  - Default OFF when no preference stored (production posture).
 *  - Reads ``true`` from localStorage correctly.
 *  - ``setDevModeEnabled(true)`` updates localStorage + dispatches
 *    the change event + the hook re-renders.
 *  - ``isDevMode()`` module-level helper agrees with the hook.
 */

import {describe, it, expect, beforeEach} from "vitest";
import {act, renderHook} from "@testing-library/react";

import {isDevMode, setDevModeEnabled, useDevMode} from "./useDevMode";

beforeEach(() => {
    localStorage.clear();
});

describe("useDevMode", () => {
    it("defaults to OFF when localStorage is empty", () => {
        const {result} = renderHook(() => useDevMode());
        expect(result.current).toBe(false);
        expect(isDevMode()).toBe(false);
    });

    it("returns true when the user opted in", () => {
        localStorage.setItem("adaptive-learner.developer_mode", "true");
        const {result} = renderHook(() => useDevMode());
        expect(result.current).toBe(true);
        expect(isDevMode()).toBe(true);
    });

    it("re-renders subscribers when setDevModeEnabled is called", () => {
        const {result} = renderHook(() => useDevMode());
        expect(result.current).toBe(false);
        act(() => {
            setDevModeEnabled(true);
        });
        expect(result.current).toBe(true);
        act(() => {
            setDevModeEnabled(false);
        });
        expect(result.current).toBe(false);
    });

    it("persists the preference to localStorage", () => {
        setDevModeEnabled(true);
        expect(localStorage.getItem("adaptive-learner.developer_mode")).toBe(
            "true",
        );
        setDevModeEnabled(false);
        expect(localStorage.getItem("adaptive-learner.developer_mode")).toBe(
            "false",
        );
    });

    it("module-level isDevMode() agrees with the stored value", () => {
        expect(isDevMode()).toBe(false);
        setDevModeEnabled(true);
        expect(isDevMode()).toBe(true);
        setDevModeEnabled(false);
        expect(isDevMode()).toBe(false);
    });
});
