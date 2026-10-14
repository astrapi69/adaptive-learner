/**
 * Tests for IosInstallHint — the iOS-only "Add to Home Screen" guidance.
 * Pins: shown on iOS Safari (not installed / not dismissed), hidden when
 * standalone, on non-iOS, or after dismissal; never over a lesson (#3749).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import IosInstallHint from "./IosInstallHint";

const standaloneState = vi.hoisted(() => ({ value: false }));

vi.mock("../../lib/pwa/install", () => ({
    isStandalone: () => standaloneState.value,
}));

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";

/** Render at a route; the hint reads the location (#3749). */
function render(ui: ReactElement, path = "/dashboard") {
    return rtlRender(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

function stubNavigator(userAgent: string, platform: string, maxTouchPoints = 5) {
    vi.stubGlobal("navigator", { userAgent, platform, maxTouchPoints });
}

beforeEach(() => {
    standaloneState.value = false;
    localStorage.clear();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("IosInstallHint", () => {
    it("shows on iOS Safari (not installed, not dismissed)", () => {
        stubNavigator(IPHONE_SAFARI, "iPhone");
        render(<IosInstallHint />);
        expect(screen.getByTestId("ios-install-hint")).toBeInTheDocument();
    });

    it("is hidden when already installed (standalone)", () => {
        stubNavigator(IPHONE_SAFARI, "iPhone");
        standaloneState.value = true;
        render(<IosInstallHint />);
        expect(screen.queryByTestId("ios-install-hint")).not.toBeInTheDocument();
    });

    it("is hidden on non-iOS (Android Chrome)", () => {
        stubNavigator(ANDROID_CHROME, "Linux armv8l");
        render(<IosInstallHint />);
        expect(screen.queryByTestId("ios-install-hint")).not.toBeInTheDocument();
    });

    it("is hidden once dismissed (persisted)", () => {
        stubNavigator(IPHONE_SAFARI, "iPhone");
        localStorage.setItem("adaptive-learner.ios_install_dismissed", "1");
        render(<IosInstallHint />);
        expect(screen.queryByTestId("ios-install-hint")).not.toBeInTheDocument();
    });

    it("dismiss button hides it and persists the dismissal", () => {
        stubNavigator(IPHONE_SAFARI, "iPhone");
        render(<IosInstallHint />);
        fireEvent.click(screen.getByTestId("ios-install-hint-dismiss"));
        expect(screen.queryByTestId("ios-install-hint")).not.toBeInTheDocument();
        expect(
            localStorage.getItem("adaptive-learner.ios_install_dismissed"),
        ).toBe("1");
    });

    // #3749 - fixed at the bottom, the hint covered the runner footer, so
    // "Weiter" could not be tapped until it was dismissed.
    it.each([
        ["lesson", "/lesson/owner--repo/set-a/01-intro.json"],
        ["error replay", "/error-replay/owner--repo/set-a/01-intro.json"],
        ["review", "/review/set-a"],
        ["adaptive lesson", "/adaptive-lesson/set-a"],
        ["shuffle lesson", "/shuffle-lesson/set-a"],
        ["endless lesson", "/endless-lesson/set-a"],
    ])("is not shown on a %s route", (_name, path) => {
        stubNavigator(IPHONE_SAFARI, "iPhone");
        render(<IosInstallHint />, path);
        expect(screen.queryByTestId("ios-install-hint")).not.toBeInTheDocument();
    });

    it("comes back after the lesson, since leaving a lesson is not a dismissal", () => {
        stubNavigator(IPHONE_SAFARI, "iPhone");
        function LeaveLesson() {
            const navigate = useNavigate();
            return (
                <button type="button" onClick={() => navigate("/dashboard")}>
                    leave
                </button>
            );
        }
        rtlRender(
            <MemoryRouter initialEntries={["/lesson/owner--repo/set-a/01-intro.json"]}>
                <IosInstallHint />
                <Routes>
                    <Route path="*" element={<LeaveLesson />} />
                </Routes>
            </MemoryRouter>,
        );
        expect(screen.queryByTestId("ios-install-hint")).not.toBeInTheDocument();
        fireEvent.click(screen.getByText("leave"));
        expect(screen.getByTestId("ios-install-hint")).toBeInTheDocument();
        expect(localStorage.getItem("adaptive-learner.ios_install_dismissed")).toBeNull();
    });
});
