/**
 * #1400 — the mobile hamburger drawer must trap keyboard focus while it
 * is open (WCAG 2.4.3 Focus Order). Pre-fix, opening the drawer left
 * focus outside it and ``Tab`` walked into the background page content
 * behind the open drawer; closing did not return focus to the burger.
 *
 * The trap reuses the shared {@link useDialogFocus} hook (#515) — the
 * same pattern as the Settings mobile menu (#546): initial focus moves
 * to the first drawer entry, Tab / Shift+Tab cycle inside the drawer,
 * and focus returns to the burger trigger on close. Pure UI — identical
 * in both storage modes.
 */

import {fireEvent, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";
import {afterAll, describe, expect, it} from "vitest";

import {stubMatchMedia} from "../../test-utils/match-media-stub";
import Navigation from "./Navigation";

// #1390 — the drawer exists only below the breakpoint; run on a stubbed
// mobile viewport.
const media = stubMatchMedia(true);
afterAll(() => media.restore());

function renderWithBackground() {
    return render(
        <MemoryRouter initialEntries={["/dashboard"]}>
            <Navigation />
            <button type="button" data-testid="background-action">
                Background
            </button>
        </MemoryRouter>,
    );
}

/** Focus + click the burger so the trap can capture it as the trigger. */
function openViaBurger() {
    const burger = screen.getByTestId("nav-hamburger");
    burger.focus();
    fireEvent.click(burger);
    expect(screen.getByTestId("nav-links").className).toContain("is-open");
    return burger;
}

describe("#1400 mobile drawer focus trap", () => {
    it("moves focus to the first drawer entry on open", () => {
        renderWithBackground();
        openViaBurger();
        expect(document.activeElement).toBe(screen.getByTestId("nav-dashboard"));
    });

    it("Tab from the last drawer entry wraps to the first", () => {
        renderWithBackground();
        openViaBurger();
        const last = screen.getByTestId("nav-help");
        last.focus();
        fireEvent.keyDown(last, {key: "Tab"});
        expect(document.activeElement).toBe(screen.getByTestId("nav-dashboard"));
    });

    it("Shift+Tab from the first drawer entry wraps to the last", () => {
        renderWithBackground();
        openViaBurger();
        const first = screen.getByTestId("nav-dashboard");
        first.focus();
        fireEvent.keyDown(first, {key: "Tab", shiftKey: true});
        expect(document.activeElement).toBe(screen.getByTestId("nav-help"));
    });

    it("Escape closes the drawer and restores focus to the burger", () => {
        renderWithBackground();
        const burger = openViaBurger();
        // Focus is inside the drawer (not still on the burger) before
        // Escape, so the final assertion proves a real focus RESTORE.
        screen.getByTestId("nav-help").focus();
        expect(document.activeElement).not.toBe(burger);
        fireEvent.keyDown(document, {key: "Escape"});
        expect(screen.getByTestId("nav-links").className).not.toContain(
            "is-open",
        );
        expect(document.activeElement).toBe(burger);
    });

    it("background content is not reachable via Tab while open", async () => {
        renderWithBackground();
        openViaBurger();
        const background = screen.getByTestId("background-action");
        const drawer = screen.getByTestId("nav-links");
        // Real Tab traversal (user-event honours preventDefault): from the
        // LAST drawer entry the next tab stop in DOM order would be the
        // background button — the trap must wrap to the first entry instead,
        // and focus must stay inside the drawer on every step of a full walk.
        const entries = drawer.querySelectorAll<HTMLElement>("a, button");
        for (let i = 0; i <= entries.length; i += 1) {
            await userEvent.tab();
            expect(document.activeElement).not.toBe(background);
            expect(drawer.contains(document.activeElement)).toBe(true);
        }
    });

    it("no trap when closed: the burger toggle itself stays focusable", () => {
        renderWithBackground();
        const burger = openViaBurger();
        fireEvent.keyDown(document, {key: "Escape"});
        // Closed again — focus management is inert; nothing yanks focus
        // away from an arbitrary element outside the drawer.
        const background = screen.getByTestId("background-action");
        background.focus();
        expect(document.activeElement).toBe(background);
        burger.focus();
        expect(document.activeElement).toBe(burger);
    });
});
