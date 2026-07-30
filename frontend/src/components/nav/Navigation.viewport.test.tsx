/**
 * #1390 — one primary navigation per viewport class (Option A).
 *
 * Desktop (> 768px): the horizontal top bar is THE primary nav — the
 * hamburger and the drawer do not exist in the DOM (not merely CSS-hidden),
 * and the removed #891 desktop sidebar (burger + fixed drawer) never
 * reappears. Mobile (<= 768px, plus lesson-compact at any width): the
 * hamburger + drawer is the nav; the links container renders as the drawer,
 * not as inline top-bar links.
 *
 * Both variants render from the ONE shared target list (``nav-targets.ts``);
 * the parity suite below derives both variants from it and breaks on any
 * divergence of the route SET.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { stubMatchMedia, type MatchMediaStub } from "../../test-utils/match-media-stub";
import { HELP_TARGET, NAV_TARGETS } from "./nav-targets";
import Navigation from "./Navigation";

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Navigation />
        </MemoryRouter>,
    );
}

/** Routes currently rendered as nav links, read from the live DOM. */
function renderedRoutes(): string[] {
    return [...document.querySelectorAll("[data-testid='nav-links'] a")]
        .map((anchor) => anchor.getAttribute("href") ?? "")
        .sort();
}

let media: MatchMediaStub;

afterEach(() => {
    media.restore();
});

describe("#1390 desktop (> breakpoint): top bar only", () => {
    beforeEach(() => {
        media = stubMatchMedia(false); // desktop viewport
    });

    it("renders NO hamburger and NO drawer artifacts in the DOM", () => {
        renderAt("/dashboard");
        expect(screen.queryByTestId("nav-hamburger")).not.toBeInTheDocument();
        // #891/#1260 desktop sidebar (second desktop primary nav) is removed.
        expect(screen.queryByTestId("sidebar-open-toggle")).not.toBeInTheDocument();
        expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
    });

    it("renders the top-bar links inline (every shared target + Help)", () => {
        renderAt("/dashboard");
        const links = screen.getByTestId("nav-links");
        expect(links.getAttribute("data-variant")).toBe("inline");
        for (const target of NAV_TARGETS) {
            expect(screen.getByTestId(target.testId)).toBeInTheDocument();
        }
        expect(screen.getByTestId(HELP_TARGET.testId)).toBeInTheDocument();
    });

    it("marks the active route in the inline variant", () => {
        renderAt("/settings");
        expect(screen.getByTestId("nav-settings").className).toContain("is-active");
        expect(screen.getByTestId("nav-settings").getAttribute("aria-current")).toBe("page");
        expect(screen.getByTestId("nav-dashboard").className).not.toContain("is-active");
    });
});

describe("#1390 mobile (<= breakpoint): hamburger + drawer only", () => {
    beforeEach(() => {
        media = stubMatchMedia(true); // mobile viewport
    });

    it("renders the hamburger; the links container is the DRAWER, not inline", () => {
        renderAt("/dashboard");
        expect(screen.getByTestId("nav-hamburger")).toBeInTheDocument();
        const links = screen.getByTestId("nav-links");
        expect(links.getAttribute("data-variant")).toBe("drawer");
        // Closed initially.
        expect(links.className).not.toContain("is-open");
    });

    it("opens the drawer on hamburger tap and closes it on Escape", () => {
        renderAt("/dashboard");
        const burger = screen.getByTestId("nav-hamburger");
        fireEvent.click(burger);
        expect(screen.getByTestId("nav-links").className).toContain("is-open");
        expect(burger.getAttribute("aria-expanded")).toBe("true");
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.getByTestId("nav-links").className).not.toContain("is-open");
        expect(burger.getAttribute("aria-expanded")).toBe("false");
    });

    it("marks the active route in the drawer variant", () => {
        renderAt("/settings");
        fireEvent.click(screen.getByTestId("nav-hamburger"));
        expect(screen.getByTestId("nav-settings").className).toContain("is-active");
        expect(screen.getByTestId("nav-settings").getAttribute("aria-current")).toBe("page");
        expect(screen.getByTestId("nav-dashboard").className).not.toContain("is-active");
    });
});

describe("#1390 parity: top bar and drawer lead to the same route set", () => {
    it("desktop inline routes == drawer routes == shared target list", () => {
        // Desktop variant.
        media = stubMatchMedia(false);
        const desktop = renderAt("/dashboard");
        const inlineRoutes = renderedRoutes();
        const inlineHasHelp = screen.queryByTestId(HELP_TARGET.testId) !== null;
        desktop.unmount();
        media.restore();

        // Mobile drawer variant (open).
        media = stubMatchMedia(true);
        renderAt("/dashboard");
        fireEvent.click(screen.getByTestId("nav-hamburger"));
        const drawerRoutes = renderedRoutes();
        const drawerHasHelp = screen.queryByTestId(HELP_TARGET.testId) !== null;

        const expected = NAV_TARGETS.map((target) => target.to).sort();
        expect(inlineRoutes).toEqual(expected);
        expect(drawerRoutes).toEqual(expected);
        // Help is an action (no route) — present in BOTH variants.
        expect(inlineHasHelp).toBe(true);
        expect(drawerHasHelp).toBe(true);
    });
});

describe("#1390 boundaries: lesson-compact + live viewport flips", () => {
    it("keeps the hamburger during a lesson even at desktop width", () => {
        media = stubMatchMedia(false); // desktop
        renderAt("/lesson/astrapi69--adaptive-learner-content/es-a1/01.json");
        // Lesson-compact mode collapses the nav behind the hamburger at any
        // width (existing behaviour, deliberately kept).
        expect(screen.getByTestId("nav-hamburger")).toBeInTheDocument();
        expect(screen.getByTestId("nav-links").getAttribute("data-variant")).toBe("drawer");
    });

    it("swaps burger in/out on a live viewport flip and resets drawer state", () => {
        media = stubMatchMedia(true); // start mobile
        renderAt("/dashboard");
        fireEvent.click(screen.getByTestId("nav-hamburger")); // open drawer
        expect(screen.getByTestId("nav-links").className).toContain("is-open");

        act(() => media.set(false)); // resize to desktop
        expect(screen.queryByTestId("nav-hamburger")).not.toBeInTheDocument();
        const inline = screen.getByTestId("nav-links");
        expect(inline.getAttribute("data-variant")).toBe("inline");
        // The open-drawer state must not leak into the inline variant…
        expect(inline.className).not.toContain("is-open");

        act(() => media.set(true)); // …and back to mobile: drawer starts closed.
        expect(screen.getByTestId("nav-hamburger")).toBeInTheDocument();
        expect(screen.getByTestId("nav-links").className).not.toContain("is-open");
    });
});
