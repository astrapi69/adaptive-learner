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

/**
 * A scroller whose scrollTop CLAMPS like a real browser's, with the max
 * derived from its current clientHeight - so shrinking it (keyboard open)
 * creates room exactly as the device does (#3019).
 */
function makeClampingScroller(maxScroll: number): HTMLDivElement {
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    const contentHeight = VIEWPORT_HEIGHT + maxScroll;
    Object.defineProperty(scroller, "scrollHeight", { value: contentHeight });
    Object.defineProperty(scroller, "clientHeight", {
        value: VIEWPORT_HEIGHT,
        configurable: true,
    });
    let position = 0;
    Object.defineProperty(scroller, "scrollTop", {
        get: () => position,
        set: (value: number) => {
            const max = contentHeight - scroller.clientHeight;
            position = Math.max(0, Math.min(value, max));
        },
    });
    document.body.appendChild(scroller);
    return scroller;
}

/**
 * A field at ``top`` in the scroller's content. Its reported viewport
 * position FOLLOWS the scroll, as a real element's does — without that a
 * second reveal would re-measure the stale pre-scroll position.
 */
function placeField(scroller: HTMLElement, top: number): HTMLInputElement {
    const field = document.createElement("input");
    field.getBoundingClientRect = () => {
        const y = top - scroller.scrollTop;
        return { top: y, bottom: y + 40, left: 0, right: 100 } as DOMRect;
    };
    scroller.appendChild(field);
    return field;
}

/**
 * Focus ``field`` for real — the late retry reads ``activeElement``.
 * ``focus()`` already emits ``focusin`` for focusable elements; only
 * non-focusable stand-ins need the manual dispatch.
 */
function focusIn(field: Element) {
    act(() => {
        (field as HTMLElement).focus?.();
        if (document.activeElement !== field) {
            field.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        }
    });
}

function focusOut(field: Element, relatedTarget: Element | null = null) {
    act(() => {
        (field as HTMLElement).blur?.();
        field.dispatchEvent(
            new FocusEvent("focusout", { bubbles: true, relatedTarget }),
        );
    });
}

/** Minimal ``visualViewport`` stand-in (happy-dom provides none). */
class VisualViewportStub extends EventTarget {
    height: number;

    constructor(height: number) {
        super();
        this.height = height;
    }
}

let viewport: VisualViewportStub;

/**
 * Simulate the keyboard opening: the visual viewport shrinks AND, under
 * interactive-widget=resizes-content, so does the layout viewport - which
 * is what finally gives the 100dvh scroller room (#3019).
 */
function openKeyboard(scroller: HTMLElement, visibleHeight: number) {
    viewport.height = visibleHeight;
    Object.defineProperty(window, "innerHeight", {
        value: visibleHeight,
        configurable: true,
    });
    Object.defineProperty(scroller, "clientHeight", {
        value: visibleHeight,
        configurable: true,
    });
    act(() => {
        viewport.dispatchEvent(new Event("resize"));
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
    viewport = new VisualViewportStub(VIEWPORT_HEIGHT);
    Object.defineProperty(window, "visualViewport", {
        value: viewport,
        configurable: true,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "visualViewport", {
        value: undefined,
        configurable: true,
    });
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

    it("retries the clamped reveal once the keyboard makes room (#3019)", () => {
        // Repro (reading 8): at focusin the 100dvh shell has NO scroll room
        // (docH === innerH), so the reveal is clamped; the room appears only
        // when the keyboard shrinks the layout viewport.
        render(<Harness />);
        const scroller = makeClampingScroller(61);
        const field = placeField(scroller, 660);
        focusIn(field);
        expect(scroller.scrollTop).toBe(61); // clamped, as measured
        // Keyboard opens: viewport 900 -> 420, the content now overflows.
        openKeyboard(scroller, 420);
        // The retry ran with the room available: 660 - 420/3 = 520.
        expect(scroller.scrollTop).toBe(520);
    });

    it("retries at most once per focus episode (#3019)", () => {
        render(<Harness />);
        const scroller = makeClampingScroller(61);
        const field = placeField(scroller, 660);
        focusIn(field);
        openKeyboard(scroller, 420);
        const afterRetry = scroller.scrollTop;
        // Further viewport churn (address bar, keyboard height change) must
        // not keep scrolling the page under the learner.
        act(() => {
            viewport.dispatchEvent(new Event("resize"));
            viewport.dispatchEvent(new Event("resize"));
        });
        expect(scroller.scrollTop).toBe(afterRetry);
    });

    it("does not retry once focus left the keyboard (#3019)", () => {
        render(<Harness />);
        const scroller = makeClampingScroller(61);
        const field = placeField(scroller, 660);
        focusIn(field);
        focusOut(field, null);
        openKeyboard(scroller, 420);
        expect(scroller.scrollTop).toBe(61); // no late scroll
    });

    it("ignores viewport churn that is not a keyboard (#3019)", () => {
        render(<Harness />);
        const scroller = makeClampingScroller(61);
        const field = placeField(scroller, 660);
        focusIn(field);
        // An address-bar reflow (60 px) is below the keyboard threshold.
        openKeyboard(scroller, 840);
        expect(scroller.scrollTop).toBe(61);
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
