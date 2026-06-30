/**
 * Tests for the useDevMode hook
 * (DEV-MODE-FRIENDLY-ERRORS-01 + environment-aware default #1271).
 *
 * Pins:
 *  - Default follows the deployment strand when no preference stored:
 *    Latest (staging) -> ON, Haupt (production) / unknown -> OFF.
 *  - An explicit stored choice ("true"/"false") wins over the
 *    environment default in BOTH directions.
 *  - Reads ``true`` from localStorage correctly.
 *  - ``setDevModeEnabled(true)`` updates localStorage + dispatches
 *    the change event + the hook re-renders.
 *  - ``isDevMode()`` module-level helper agrees with the hook.
 */

import {describe, it, expect, beforeEach, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";

import {getBuildInfo} from "../../lib/provenance/build-info";
import {isDevMode, setDevModeEnabled, useDevMode} from "./useDevMode";

vi.mock("../../lib/provenance/build-info", () => ({
    getBuildInfo: vi.fn(() => ({strang: "unknown"})),
}));

const mockedGetBuildInfo = vi.mocked(getBuildInfo);

function setStrang(strang: "latest" | "haupt" | "unknown") {
    mockedGetBuildInfo.mockReturnValue({strang} as ReturnType<
        typeof getBuildInfo
    >);
}

beforeEach(() => {
    localStorage.clear();
    setStrang("unknown");
});

describe("useDevMode", () => {
    it("defaults to OFF when localStorage is empty (unknown env)", () => {
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

    describe("environment-aware default (#1271)", () => {
        it("defaults to ON in the Latest (staging) strand", () => {
            setStrang("latest");
            const {result} = renderHook(() => useDevMode());
            expect(result.current).toBe(true);
            expect(isDevMode()).toBe(true);
        });

        it("defaults to OFF in the Haupt (production) strand", () => {
            setStrang("haupt");
            const {result} = renderHook(() => useDevMode());
            expect(result.current).toBe(false);
            expect(isDevMode()).toBe(false);
        });

        it("defaults to OFF in an unknown/local strand (safe)", () => {
            setStrang("unknown");
            const {result} = renderHook(() => useDevMode());
            expect(result.current).toBe(false);
            expect(isDevMode()).toBe(false);
        });

        it("explicit OFF wins over the Latest default", () => {
            setStrang("latest");
            localStorage.setItem("adaptive-learner.developer_mode", "false");
            const {result} = renderHook(() => useDevMode());
            expect(result.current).toBe(false);
            expect(isDevMode()).toBe(false);
        });

        it("explicit ON wins over the Haupt default", () => {
            setStrang("haupt");
            localStorage.setItem("adaptive-learner.developer_mode", "true");
            const {result} = renderHook(() => useDevMode());
            expect(result.current).toBe(true);
            expect(isDevMode()).toBe(true);
        });

        it("falls back to OFF when the build-info read throws", () => {
            mockedGetBuildInfo.mockImplementation(() => {
                throw new Error("no build info");
            });
            const {result} = renderHook(() => useDevMode());
            expect(result.current).toBe(false);
            expect(isDevMode()).toBe(false);
        });
    });
});
