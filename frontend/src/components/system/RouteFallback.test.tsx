/**
 * RouteFallback tests (#2573) — the lazy-route loading + failure UI must
 * never be an empty box: it renders a visible loading state, escalates to a
 * reload affordance when a chunk stalls, and surfaces a readable reload UI
 * when a chunk import rejects.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteLoadError, RouteLoading, isChunkLoadError } from "./RouteFallback";

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        lang: "en",
        setLang: vi.fn(),
    }),
}));

const {devMode} = vi.hoisted(() => ({devMode: {on: false}}));
vi.mock("../../hooks/settings/useDevMode", () => ({useDevMode: () => devMode.on}));

const reloadMock = vi.fn();

beforeEach(() => {
    reloadMock.mockClear();
    devMode.on = false;
    Object.defineProperty(window.location, "reload", {
        configurable: true,
        value: reloadMock,
    });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("RouteLoading", () => {
    it("renders a visible loading indicator immediately (never an empty fallback)", () => {
        render(<RouteLoading />);
        expect(screen.getByTestId("route-loading")).toBeTruthy();
        expect(screen.getByTestId("route-loading-spinner")).toBeTruthy();
        expect(screen.getByText("Loading…")).toBeTruthy();
        // The reload escalation is NOT shown before the slow timeout.
        expect(screen.queryByTestId("route-loading-slow")).toBeNull();
    });

    it("escalates to a readable reload affordance after slowAfterMs", () => {
        vi.useFakeTimers();
        render(<RouteLoading slowAfterMs={5000} />);
        expect(screen.queryByTestId("route-loading-slow")).toBeNull();

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(screen.getByTestId("route-loading-slow")).toBeTruthy();
        expect(screen.getByText("This is taking longer than expected.")).toBeTruthy();
        fireEvent.click(screen.getByTestId("route-loading-reload"));
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });
});

describe("RouteLoadError", () => {
    it("shows a readable message and reloads on click; detail only in dev mode", () => {
        devMode.on = true;
        render(<RouteLoadError error={new Error("Failed to fetch dynamically imported module")} />);
        expect(screen.getByText("This view could not be loaded.")).toBeTruthy();
        expect(screen.getByTestId("route-load-error-detail").textContent).toContain(
            "Failed to fetch",
        );
        expect(screen.queryByTestId("route-load-error-report")).toBeNull();
        fireEvent.click(screen.getByTestId("route-load-error-reload"));
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("calls a render crash a crash, hides the raw message, offers Report Issue (#3390)", () => {
        const opened = vi.fn();
        window.addEventListener("adaptive-learner:open-error-report", opened);
        render(<RouteLoadError error={new TypeError("Cannot read properties of undefined")} />);
        expect(
            screen.getByText("Something went wrong on this page. The other pages still work."),
        ).toBeTruthy();
        expect(screen.queryByText("This view could not be loaded.")).toBeNull();
        expect(screen.queryByTestId("route-load-error-detail")).toBeNull();
        fireEvent.click(screen.getByTestId("route-load-error-report"));
        expect(opened).toHaveBeenCalledTimes(1);
        const detail = (opened.mock.calls[0][0] as CustomEvent).detail as {message: string};
        expect(detail.message).toContain("TypeError: Cannot read properties of undefined");
        window.removeEventListener("adaptive-learner:open-error-report", opened);
    });

    it.each([
        ["Failed to fetch dynamically imported module: /a.js", true],
        ["Importing a module script failed.", true],
        ["error loading dynamically imported module", true],
        ["Loading chunk 42 failed.", true],
        ["Cannot read properties of undefined", false],
    ])("classifies %j as a chunk load error: %s", (message, chunk) => {
        expect(isChunkLoadError(new Error(message))).toBe(chunk);
    });

    it("renders without a detail line when no error message is given", () => {
        render(<RouteLoadError />);
        expect(screen.getByText("This view could not be loaded.")).toBeTruthy();
        expect(screen.queryByTestId("route-load-error-detail")).toBeNull();
    });
});
