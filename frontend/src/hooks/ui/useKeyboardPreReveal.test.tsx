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

function focusOut(field: Element, relatedTarget: Element | null = null) {
    act(() => {
        field.dispatchEvent(
            new FocusEvent("focusout", { bubbles: true, relatedTarget }),
        );
    });
}

/**
 * A scroller whose scrollTop CLAMPS like a real browser's: the maximum
 * grows with inline bottom padding, mirroring how padding extends
 * scrollHeight (#3014 - reading 8's clamped reveal, max 61 of 218).
 */
function makeClampingScroller(maxScroll: number): HTMLDivElement {
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    Object.defineProperty(scroller, "scrollHeight", { value: 2000 });
    Object.defineProperty(scroller, "clientHeight", { value: VIEWPORT_HEIGHT });
    let position = 0;
    Object.defineProperty(scroller, "scrollTop", {
        get: () => position,
        set: (value: number) => {
            const pad = parseFloat(scroller.style.paddingBottom) || 0;
            position = Math.max(0, Math.min(value, maxScroll + pad));
        },
    });
    document.body.appendChild(scroller);
    return scroller;
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

    it("grants missing headroom when the scroller clamps the reveal (#3014)", () => {
        // Repro (reading 8): delta=218 wanted, scroller at its end after 61
        // (docH == viewport height) - Safari panned 327 anyway.
        render(<Harness />);
        const scroller = makeClampingScroller(61);
        const field = placeField(scroller, 660); // delta = 360
        focusIn(field);
        // The shortfall (360 - 61 = 299) became temporary bottom padding and
        // the reveal then completed in full.
        expect(scroller.style.paddingBottom).toBe("299px");
        expect(scroller.scrollTop).toBe(360);
    });

    it("releases the granted headroom when focus leaves the keyboard (#3014)", () => {
        render(<Harness />);
        const scroller = makeClampingScroller(61);
        const field = placeField(scroller, 660);
        focusIn(field);
        expect(scroller.style.paddingBottom).toBe("299px");
        focusOut(field, null);
        expect(scroller.style.paddingBottom).toBe("");
    });

    it("keeps the headroom across a field-to-field focus move (#3014)", () => {
        render(<Harness />);
        const scroller = makeClampingScroller(61);
        const field = placeField(scroller, 660);
        const nextField = placeField(scroller, 200);
        focusIn(field);
        focusOut(field, nextField);
        expect(scroller.style.paddingBottom).toBe("299px");
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
