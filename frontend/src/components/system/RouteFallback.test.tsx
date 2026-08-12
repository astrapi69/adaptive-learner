/**
 * RouteFallback tests (#2573) — the lazy-route loading + failure UI must
 * never be an empty box: it renders a visible loading state, escalates to a
 * reload affordance when a chunk stalls, and surfaces a readable reload UI
 * when a chunk import rejects.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteLoadError, RouteLoading } from "./RouteFallback";

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        lang: "en",
        setLang: vi.fn(),
    }),
}));

const reloadMock = vi.fn();

beforeEach(() => {
    reloadMock.mockClear();
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
    it("shows a readable message + detail and reloads on click", () => {
        render(<RouteLoadError error={new Error("Failed to fetch dynamically imported module")} />);
        expect(screen.getByText("This view could not be loaded.")).toBeTruthy();
        expect(screen.getByTestId("route-load-error-detail").textContent).toContain(
            "Failed to fetch",
        );
        fireEvent.click(screen.getByTestId("route-load-error-reload"));
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("renders without a detail line when no error message is given", () => {
        render(<RouteLoadError />);
        expect(screen.getByText("This view could not be loaded.")).toBeTruthy();
        expect(screen.queryByTestId("route-load-error-detail")).toBeNull();
    });
});
