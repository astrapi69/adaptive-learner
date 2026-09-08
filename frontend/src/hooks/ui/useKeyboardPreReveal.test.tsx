/**
 * Tests for useKeyboardPreReveal (#3002) — the app-side reveal that makes
 * Safari's viewport pan unnecessary. Reading 6 of #1569 pinned the
 * remaining mechanism: ``@rootY=0`` in every measurement — the app never
 * scrolled a focused field above the keyboard itself, so Safari panned
 * the visual viewport and taps landed in the shifted grid.
 */

import { render } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearVvLog, readVvLog } from "../../lib/diagnostics/vv-log";
import { useKeyboardPreReveal } from "./useKeyboardPreReveal";

function Harness() {
    useKeyboardPreReveal();
    return <div data-testid="harness" />;
}

const VIEWPORT_HEIGHT = 900; // safe band ends at 300 (one third)

/** A scroller happy-dom treats as scrollable (it has no real layout). */
function makeScroller(): HTMLDivElement {
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    Object.defineProperty(scroller, "scrollHeight", { value: 2000 });
    Object.defineProperty(scroller, "clientHeight", { value: VIEWPORT_HEIGHT });
    document.body.appendChild(scroller);
    return scroller;
}

function placeField(scroller: HTMLElement, top: number): HTMLInputElement {
    const field = document.createElement("input");
    field.getBoundingClientRect = () =>
        ({ top, bottom: top + 40, left: 0, right: 100 }) as DOMRect;
    scroller.appendChild(field);
    return field;
}

function focusIn(field: Element) {
    act(() => {
        field.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
}

let coarsePointer = true;

beforeEach(() => {
    coarsePointer = true;
    vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === "(pointer: coarse)" && coarsePointer,
    }));
    Object.defineProperty(window, "innerHeight", {
        value: VIEWPORT_HEIGHT,
        configurable: true,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
});

describe("useKeyboardPreReveal (#3002)", () => {
    it("scrolls a low-sitting field into the upper third on focus", () => {
        // Repro (reading 6): input at ~660 of 900, keyboard covers the lower
        // half — without a pre-reveal Safari pans the viewport by ~440.
        render(<Harness />);
        const scroller = makeScroller();
        const field = placeField(scroller, 660);
        focusIn(field);
        expect(scroller.scrollTop).toBe(360); // 660 - 900/3
    });

    it("falls back to #root when no scrollable ancestor exists", () => {
        render(<Harness />);
        const root = document.createElement("div");
        root.id = "root";
        document.body.appendChild(root);
        const field = document.createElement("input");
        field.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;
        document.body.appendChild(field);
        focusIn(field);
        expect(root.scrollTop).toBe(200); // 500 - 300
    });

    it("never yanks a field UP that already sits in the safe band", () => {
        render(<Harness />);
        const scroller = makeScroller();
        const field = placeField(scroller, 120);
        focusIn(field);
        expect(scroller.scrollTop).toBe(0);
    });

    it("ignores focus that summons no keyboard (checkbox, select)", () => {
        render(<Harness />);
        const scroller = makeScroller();
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.getBoundingClientRect = () => ({ top: 700 }) as DOMRect;
        const select = document.createElement("select");
        select.getBoundingClientRect = () => ({ top: 700 }) as DOMRect;
        scroller.append(checkbox, select);
        focusIn(checkbox);
        focusIn(select);
        expect(scroller.scrollTop).toBe(0);
    });

    it("is inert on fine-pointer (desktop) devices", () => {
        coarsePointer = false;
        render(<Harness />);
        const scroller = makeScroller();
        const field = placeField(scroller, 660);
        focusIn(field);
        expect(scroller.scrollTop).toBe(0);
    });

    it("logs the applied reveal to the protocol while the probe is enabled", () => {
        localStorage.setItem("adaptive-learner.vv_diag", "1");
        clearVvLog();
        try {
            render(<Harness />);
            const scroller = makeScroller();
            const field = placeField(scroller, 660);
            focusIn(field);
            const logged = readVvLog().filter((e) => e.kind === "hook");
            expect(logged).toHaveLength(1);
            expect(logged[0].decision).toBe("prereveal");
            expect(logged[0].delta).toBe(360);
        } finally {
            clearVvLog();
            localStorage.removeItem("adaptive-learner.vv_diag");
        }
    });
});
