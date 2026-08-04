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
    return renderedRoutesInOrder().sort();
}

/** Routes as rendered, in DOM order (used to pin the nav SEQUENCE). */
function renderedRoutesInOrder(): string[] {
    return [...document.querySelectorAll("[data-testid='nav-links'] a")].map(
        (anchor) => anchor.getAttribute("href") ?? "",
    );
}

/**
 * #2343 — the route set the nav MUST expose, written literally (NOT derived
 * from NAV_TARGETS). Comparing the rendered DOM against this instead of
 * against NAV_TARGETS.map(...) breaks the self-reference: an empty or wrong
 * model now fails here instead of matching an equally-empty ``expected``.
 */
const EXPECTED_ROUTES_SORTED = [
    "/content",
    "/dashboard",
    "/learning-path",
    "/progress",
    "/session",
    "/settings",
];

/** The same routes in render order (group order LEARN, CONTENT, PROGRESS, then Settings). */
const EXPECTED_ROUTES_IN_ORDER = [
    "/dashboard",
    "/learning-path",
    "/session",
    "/content",
    "/progress",
    "/settings",
];

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

        // #2343 non-vacuity guard: both variants must render a NON-EMPTY set,
        // and it must equal the LITERAL expected routes — not merely equal each
        // other (which an empty model satisfies too).
        expect(inlineRoutes.length).toBeGreaterThan(0);
        expect(drawerRoutes.length).toBeGreaterThan(0);
        expect(inlineRoutes).toEqual(EXPECTED_ROUTES_SORTED);
        expect(drawerRoutes).toEqual(EXPECTED_ROUTES_SORTED);
        // The model itself agrees with the literal (so the guard above cannot be
        // satisfied by a renderer that silently drops or invents routes).
        expect(NAV_TARGETS.map((target) => target.to).sort()).toEqual(EXPECTED_ROUTES_SORTED);
        // Help is an action (no route) — present in BOTH variants.
        expect(inlineHasHelp).toBe(true);
        expect(drawerHasHelp).toBe(true);
    });

    it("desktop renders the exact literal target set + Help (mirrors mobile pin)", () => {
        // Navigation.test.tsx pins the literal testid list on MOBILE only
        // (stubMatchMedia(true) at module level). #2343: desktop was uncovered,
        // so an empty/wrong model read green on the desktop top bar. Pin it here.
        media = stubMatchMedia(false); // desktop
        renderAt("/dashboard");
        for (const id of [
            "nav-dashboard",
            "nav-learning-path",
            "nav-session",
            "nav-content",
            "nav-progress",
            "nav-settings",
            "nav-help",
        ]) {
            expect(screen.getByTestId(id)).toBeInTheDocument();
        }
        // Removed from the bar — must NOT reappear at desktop width.
        for (const id of [
            "nav-curriculum",
            "nav-statistics",
            "nav-import",
            "nav-anki",
            "nav-discover",
            "nav-contribute",
        ]) {
            expect(screen.queryByTestId(id)).not.toBeInTheDocument();
        }
    });

    it("desktop inline links render in the declared group order (#2343)", () => {
        // renderedRoutes() sorts, so sequence was pinned by nothing. Pin the
        // DOM order against the literal render order.
        media = stubMatchMedia(false); // desktop
        renderAt("/dashboard");
        expect(renderedRoutesInOrder()).toEqual(EXPECTED_ROUTES_IN_ORDER);
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
