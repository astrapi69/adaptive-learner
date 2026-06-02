import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it} from "vitest";

import Navigation from "./Navigation";

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Navigation />
        </MemoryRouter>,
    );
}

describe("Navigation", () => {
    it("hides itself on the pre-onboarding funnel routes", () => {
        for (const path of ["/", "/onboarding", "/assessment"]) {
            const {unmount} = renderAt(path);
            expect(screen.queryByTestId("app-nav")).not.toBeInTheDocument();
            unmount();
        }
    });

    it("renders on /dashboard with the four canonical links", () => {
        renderAt("/dashboard");
        expect(screen.getByTestId("app-nav")).toBeInTheDocument();
        expect(screen.getByTestId("nav-dashboard")).toBeInTheDocument();
        expect(screen.getByTestId("nav-session")).toBeInTheDocument();
        expect(screen.getByTestId("nav-progress")).toBeInTheDocument();
        expect(screen.getByTestId("nav-settings")).toBeInTheDocument();
    });

    it("highlights the active route via NavLink isActive", () => {
        renderAt("/settings");
        const active = screen.getByTestId("nav-settings");
        const other = screen.getByTestId("nav-dashboard");
        expect(active.className).toContain("is-active");
        expect(other.className).not.toContain("is-active");
    });

    it("exposes a theme toggle button", () => {
        renderAt("/dashboard");
        expect(screen.getByTestId("nav-theme-toggle")).toBeInTheDocument();
    });

    // --- v0.6.0 / 9A: hamburger drawer ----------------------------------

    it("renders the hamburger button with correct aria attributes", () => {
        renderAt("/dashboard");
        const burger = screen.getByTestId("nav-hamburger");
        expect(burger).toBeInTheDocument();
        // Closed initially.
        expect(burger.getAttribute("aria-expanded")).toBe("false");
        expect(burger.getAttribute("aria-controls")).toBe("app-nav-links");
    });

    it("toggles the nav-links drawer open/closed on hamburger click", () => {
        renderAt("/dashboard");
        const burger = screen.getByTestId("nav-hamburger");
        const links = screen.getByTestId("nav-links");
        // Closed initially.
        expect(links.className).not.toContain("is-open");
        // Open.
        fireEvent.click(burger);
        expect(links.className).toContain("is-open");
        expect(burger.getAttribute("aria-expanded")).toBe("true");
        // Close again.
        fireEvent.click(burger);
        expect(links.className).not.toContain("is-open");
        expect(burger.getAttribute("aria-expanded")).toBe("false");
    });

    it("app-nav class reflects menu-open state", () => {
        renderAt("/dashboard");
        const nav = screen.getByTestId("app-nav");
        expect(nav.className).not.toContain("is-menu-open");
        fireEvent.click(screen.getByTestId("nav-hamburger"));
        expect(nav.className).toContain("is-menu-open");
    });

    // --- lesson-mode compact nav ---------------------------------------

    it("does NOT mark the nav compact on non-lesson routes", () => {
        renderAt("/dashboard");
        const nav = screen.getByTestId("app-nav");
        expect(nav.className).not.toContain("is-lesson-compact");
        expect(nav.getAttribute("data-lesson-compact")).toBe("false");
    });

    it("marks the nav compact on lesson / review / adaptive routes", () => {
        for (const path of [
            "/lesson/astrapi69--adaptive-learner-content/es-a1/01.json",
            "/review/es-a1",
            "/adaptive-lesson/es-a1",
        ]) {
            const {unmount} = renderAt(path);
            const nav = screen.getByTestId("app-nav");
            expect(nav.className).toContain("is-lesson-compact");
            expect(nav.getAttribute("data-lesson-compact")).toBe("true");
            unmount();
        }
    });

    it("keeps the nav links in the DOM (behind the hamburger) in compact mode", () => {
        // CSS hides them; the markup stays so keyboard users and the
        // drawer toggle still reach every destination during a lesson.
        renderAt("/lesson/astrapi69--adaptive-learner-content/es-a1/01.json");
        expect(screen.getByTestId("nav-links")).toBeInTheDocument();
        expect(screen.getByTestId("nav-dashboard")).toBeInTheDocument();
        expect(screen.getByTestId("nav-settings")).toBeInTheDocument();
        expect(screen.getByTestId("nav-hamburger")).toBeInTheDocument();
    });

    // --- v0.6.0 / 9D: online indicator ---------------------------------

    it("renders the online indicator with role=status", () => {
        renderAt("/dashboard");
        const indicator = screen.getByTestId("nav-online-indicator");
        expect(indicator).toBeInTheDocument();
        expect(indicator.getAttribute("role")).toBe("status");
        expect(indicator.getAttribute("aria-live")).toBe("polite");
    });

    it("reflects offline state when navigator.onLine is false", () => {
        const original = Object.getOwnPropertyDescriptor(
            window.navigator,
            "onLine",
        );
        Object.defineProperty(window.navigator, "onLine", {
            configurable: true,
            value: false,
        });
        try {
            renderAt("/dashboard");
            const indicator = screen.getByTestId("nav-online-indicator");
            expect(indicator.getAttribute("data-online")).toBe("false");
            expect(indicator.className).toContain("is-offline");
        } finally {
            if (original) {
                Object.defineProperty(
                    window.navigator,
                    "onLine",
                    original,
                );
            }
        }
    });

    // --- Issue 3: Help in navigation menu -----------------------------

    it("exposes a Help menu button that opens the drawer without route change", async () => {
        // Mount with the full provider tree so useHelp() sees a
        // real HelpProvider (the nav button calls openHelp which
        // would otherwise no-op in the bare hook fallback).
        const {HelpProvider} = await import("../contexts/HelpContext");
        const HelpDrawer = (await import("./help/HelpDrawer")).default;
        render(
            <MemoryRouter initialEntries={["/dashboard"]}>
                <HelpProvider>
                    <Navigation />
                    <HelpDrawer />
                </HelpProvider>
            </MemoryRouter>,
        );
        const helpBtn = screen.getByTestId("nav-help");
        expect(helpBtn).toBeInTheDocument();
        // Before click: drawer not mounted.
        expect(screen.queryByTestId("help-drawer")).not.toBeInTheDocument();
        fireEvent.click(helpBtn);
        // After click: drawer is mounted (no route change).
        expect(screen.getByTestId("help-drawer")).toBeInTheDocument();
    });

    it("reflects online state when navigator.onLine is true", () => {
        const original = Object.getOwnPropertyDescriptor(
            window.navigator,
            "onLine",
        );
        Object.defineProperty(window.navigator, "onLine", {
            configurable: true,
            value: true,
        });
        try {
            renderAt("/dashboard");
            const indicator = screen.getByTestId("nav-online-indicator");
            expect(indicator.getAttribute("data-online")).toBe("true");
            expect(indicator.className).toContain("is-online");
        } finally {
            if (original) {
                Object.defineProperty(
                    window.navigator,
                    "onLine",
                    original,
                );
            }
        }
    });
});
