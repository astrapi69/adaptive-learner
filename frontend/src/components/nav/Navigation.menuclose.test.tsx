/**
 * #666 — the main hamburger drawer must close on EVERY exit path, not only
 * on a cross-route navigation. The pre-fix code closed the drawer solely via
 * a ``pathname`` effect, so:
 *   - a tap on a link to the route the user is ALREADY on left it open
 *     (no pathname change), and
 *   - there was no Escape / outside-click handler at all.
 *
 * Mirrors the #593 SettingsMobileMenu fix (pointerdown for iOS reliability).
 * Pure UI — identical in both storage modes.
 */

import {act, fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter, Route, Routes, useNavigate} from "react-router";
import {afterAll, describe, expect, it} from "vitest";

import {stubMatchMedia} from "../../test-utils/match-media-stub";
import Navigation from "./Navigation";

// #1390 — the drawer exists only below the breakpoint; run on a stubbed
// mobile viewport.
const media = stubMatchMedia(true);
afterAll(() => media.restore());

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Navigation />
        </MemoryRouter>,
    );
}

function open() {
    fireEvent.click(screen.getByTestId("nav-hamburger"));
    expect(screen.getByTestId("nav-links").className).toContain("is-open");
}

describe("#666 main hamburger drawer: close behaviour", () => {
    it("repro: tapping a SAME-ROUTE link closes the drawer (pathname unchanged)", () => {
        renderAt("/settings");
        open();
        // Tap the link for the page we're already on — pathname does not
        // change, so the route-change effect can't close it. The per-link
        // onClick must.
        fireEvent.click(screen.getByTestId("nav-settings"));
        expect(screen.getByTestId("nav-links").className).not.toContain(
            "is-open",
        );
        expect(screen.getByTestId("nav-hamburger").getAttribute("aria-expanded")).toBe(
            "false",
        );
    });

    it("happy path: tapping a different-route link closes + navigates", () => {
        render(
            <MemoryRouter initialEntries={["/settings"]}>
                <Routes>
                    <Route
                        path="*"
                        element={
                            <>
                                <Navigation />
                                <Routes>
                                    <Route
                                        path="/dashboard"
                                        element={<div data-testid="dash" />}
                                    />
                                </Routes>
                            </>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );
        open();
        fireEvent.click(screen.getByTestId("nav-dashboard"));
        // Navigated…
        expect(screen.getByTestId("dash")).toBeInTheDocument();
        // …and the drawer is closed.
        expect(screen.getByTestId("nav-links").className).not.toContain(
            "is-open",
        );
    });

    it("closes on Escape", () => {
        renderAt("/dashboard");
        open();
        fireEvent.keyDown(document, {key: "Escape"});
        expect(screen.getByTestId("nav-links").className).not.toContain(
            "is-open",
        );
    });

    it("closes on an outside pointerdown (iOS-reliable, not mousedown)", () => {
        renderAt("/dashboard");
        open();
        fireEvent.pointerDown(document.body);
        expect(screen.getByTestId("nav-links").className).not.toContain(
            "is-open",
        );
    });

    it("does NOT close on a pointerdown INSIDE the nav", () => {
        renderAt("/dashboard");
        open();
        // A pointerdown on the nav brand (inside <nav>, not a link tap) must
        // not close the drawer — only the toggle / links / outside do.
        fireEvent.pointerDown(screen.getByTestId("app-nav"));
        expect(screen.getByTestId("nav-links").className).toContain("is-open");
    });

    it("closes on a route change (back-button backstop)", () => {
        function BackButton() {
            const navigate = useNavigate();
            return (
                <button
                    type="button"
                    data-testid="go-back"
                    onClick={() => navigate("/progress")}
                />
            );
        }
        render(
            <MemoryRouter initialEntries={["/dashboard"]}>
                <Navigation />
                <BackButton />
            </MemoryRouter>,
        );
        open();
        // Programmatic navigation (simulates the browser back button) →
        // pathname changes → the backstop effect closes the drawer.
        act(() => {
            fireEvent.click(screen.getByTestId("go-back"));
        });
        expect(screen.getByTestId("nav-links").className).not.toContain(
            "is-open",
        );
    });

    it("boundary: rapid double-toggle ends closed, no stuck-open flicker", () => {
        renderAt("/dashboard");
        const burger = screen.getByTestId("nav-hamburger");
        fireEvent.click(burger); // open
        fireEvent.click(burger); // close
        expect(screen.getByTestId("nav-links").className).not.toContain(
            "is-open",
        );
        fireEvent.click(burger); // open
        fireEvent.click(burger); // close
        expect(screen.getByTestId("nav-links").className).not.toContain(
            "is-open",
        );
        expect(burger.getAttribute("aria-expanded")).toBe("false");
    });

    it("tapping the Help button (no route change) also closes the drawer", () => {
        renderAt("/dashboard");
        open();
        fireEvent.click(screen.getByTestId("nav-help"));
        expect(screen.getByTestId("nav-links").className).not.toContain(
            "is-open",
        );
    });
});
