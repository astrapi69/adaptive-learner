import {act, fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

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

// --- lesson header auto-hide on scroll --------------------------------

describe("Navigation: lesson header auto-hide", () => {
    // The nav observes the #root scroll container (html/body are
    // overflow-locked; #root provides the scroll). Provide one + drive it.
    let root: HTMLElement;

    beforeEach(() => {
        root = document.createElement("div");
        root.id = "root";
        document.body.appendChild(root);
    });

    afterEach(() => {
        root.remove();
    });

    function scrollTo(y: number): void {
        root.scrollTop = y;
        act(() => {
            root.dispatchEvent(new Event("scroll"));
        });
    }

    const LESSON_PATH = "/lesson/astrapi69--content/es-a1/01.json";

    it("hides the header on scroll-down during a lesson", () => {
        renderAt(LESSON_PATH);
        const nav = screen.getByTestId("app-nav");
        expect(nav.getAttribute("data-nav-hidden")).toBe("false");
        scrollTo(120);
        expect(nav.getAttribute("data-nav-hidden")).toBe("true");
        expect(nav.className).toContain("-translate-y-full");
    });

    it("reveals the header on scroll-up during a lesson", () => {
        renderAt(LESSON_PATH);
        const nav = screen.getByTestId("app-nav");
        scrollTo(120); // down -> hidden
        expect(nav.getAttribute("data-nav-hidden")).toBe("true");
        scrollTo(40); // up -> visible
        expect(nav.getAttribute("data-nav-hidden")).toBe("false");
        expect(nav.className).not.toContain("-translate-y-full");
    });

    it("keeps the header visible at the top of a lesson", () => {
        renderAt(LESSON_PATH);
        const nav = screen.getByTestId("app-nav");
        scrollTo(120); // down
        scrollTo(0); // back to top
        expect(nav.getAttribute("data-nav-hidden")).toBe("false");
    });

    it("also auto-hides on /error-replay (a lesson surface)", () => {
        renderAt("/error-replay/astrapi69--content/es-a1/01.json");
        const nav = screen.getByTestId("app-nav");
        scrollTo(120);
        expect(nav.getAttribute("data-nav-hidden")).toBe("true");
    });

    it("never hides the header outside a lesson, even on scroll-down", () => {
        renderAt("/dashboard");
        const nav = screen.getByTestId("app-nav");
        scrollTo(200);
        expect(nav.getAttribute("data-nav-hidden")).toBe("false");
        expect(nav.className).not.toContain("-translate-y-full");
    });

    it("keeps the header visible while the menu drawer is open", () => {
        renderAt(LESSON_PATH);
        const nav = screen.getByTestId("app-nav");
        fireEvent.click(screen.getByTestId("nav-hamburger")); // open drawer
        scrollTo(200); // scrolling down, but the drawer is open
        expect(nav.getAttribute("data-nav-hidden")).toBe("false");
    });

    it("applies a reduced-motion-safe slide transition", () => {
        renderAt(LESSON_PATH);
        const nav = screen.getByTestId("app-nav");
        expect(nav.className).toContain("transition-transform");
        expect(nav.className).toContain("motion-reduce:transition-none");
    });
});
