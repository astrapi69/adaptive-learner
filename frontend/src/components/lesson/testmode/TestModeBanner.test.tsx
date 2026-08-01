/**
 * Tests for the test-mode banner (#2319): visible while active, hidden when
 * off, exit control calls disable.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";

import TestModeBanner from "./TestModeBanner";
import {
    TestModeContext,
    type TestModeContextValue,
} from "../../../hooks/lesson/modes/useTestMode";

function renderBanner(overrides: Partial<TestModeContextValue>) {
    const value: TestModeContextValue = {
        available: true,
        enabled: true,
        enable: () => {},
        disable: () => {},
        ...overrides,
    };
    const ui: ReactNode = (
        <TestModeContext.Provider value={value}>
            <TestModeBanner />
        </TestModeContext.Provider>
    );
    return {value, ...render(ui)};
}

describe("TestModeBanner", () => {
    it("renders nothing when test mode is off", () => {
        renderBanner({enabled: false});
        expect(screen.queryByTestId("test-mode-banner")).not.toBeInTheDocument();
    });

    it("is a live status region while active", () => {
        renderBanner({enabled: true});
        const banner = screen.getByTestId("test-mode-banner");
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveAttribute("role", "status");
    });

    it("exit control calls disable", () => {
        const disable = vi.fn();
        renderBanner({enabled: true, disable});
        fireEvent.click(screen.getByTestId("test-mode-exit"));
        expect(disable).toHaveBeenCalledTimes(1);
    });
});
