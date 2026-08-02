/**
 * Tests for the test-mode provider (#2319): the build gate + enable/disable.
 */

import {act, render, renderHook, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";

import {TestModeProvider, useTestMode} from "./useTestMode";

afterEach(() => {
    vi.unstubAllEnvs();
});

const wrapper = ({children}: {children: ReactNode}) => (
    <TestModeProvider>{children}</TestModeProvider>
);

describe("useTestMode without a provider", () => {
    it("defaults to unavailable + disabled (safe for every other consumer)", () => {
        const {result} = renderHook(() => useTestMode());
        expect(result.current.available).toBe(false);
        expect(result.current.enabled).toBe(false);
        // enable() is a no-op and must not throw.
        act(() => result.current.enable());
        expect(result.current.enabled).toBe(false);
    });
});

describe("TestModeProvider build gate", () => {
    it("cannot enable when the build did not opt in", () => {
        vi.stubEnv("VITE_TEST_MODE", "");
        const {result} = renderHook(() => useTestMode(), {wrapper});
        expect(result.current.available).toBe(false);
        act(() => result.current.enable());
        expect(result.current.enabled).toBe(false);
    });

    it("enables + disables when the build opted in", () => {
        vi.stubEnv("VITE_TEST_MODE", "true");
        const {result} = renderHook(() => useTestMode(), {wrapper});
        expect(result.current.available).toBe(true);
        expect(result.current.enabled).toBe(false);
        act(() => result.current.enable());
        expect(result.current.enabled).toBe(true);
        act(() => result.current.disable());
        expect(result.current.enabled).toBe(false);
    });
});

describe("TestModeProvider reset on exit (unmount)", () => {
    it("starts disabled again after remount (no persistence)", () => {
        vi.stubEnv("VITE_TEST_MODE", "true");

        function Probe() {
            const {enabled, enable} = useTestMode();
            return (
                <>
                    <span data-testid="state">{enabled ? "on" : "off"}</span>
                    <button data-testid="enable" onClick={enable}>
                        on
                    </button>
                </>
            );
        }

        const first = render(
            <TestModeProvider>
                <Probe />
            </TestModeProvider>,
        );
        act(() => screen.getByTestId("enable").click());
        expect(screen.getByTestId("state").textContent).toBe("on");
        first.unmount();

        // A fresh mount (leaving + re-entering the lesson) starts off.
        render(
            <TestModeProvider>
                <Probe />
            </TestModeProvider>,
        );
        expect(screen.getByTestId("state").textContent).toBe("off");
    });
});
