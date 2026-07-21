/**
 * Tests for useVisualViewportRealign (#1569) — the iOS tap-offset fix.
 *
 * iOS Safari scrolls the WINDOW (layout viewport) to reveal a focused
 * control when the on-screen keyboard opens, even though ``html``/``body``
 * are scroll-locked (``overflow: hidden``, #1415 shell). The app only ever
 * scrolls ``#root``, so nothing resets that phantom window scroll — the
 * rendered content stays shifted against the layout hit-test grid and
 * every subsequent tap lands ~1-2 lines below the visible target until a
 * first "wasted" tap realigns the viewports. The hook resets the phantom
 * scroll (``window.scrollTo(0, 0)``) as soon as the keyboard is closed,
 * and NEVER while the keyboard is open (Safari owns the reveal scroll) or
 * while the user is pinch-zoomed (``visualViewport.scale > 1`` — the
 * misdetection that sank the reverted #1570 shell fix).
 */

import { render } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVisualViewportRealign } from "./useVisualViewportRealign";

function Harness() {
    useVisualViewportRealign();
    return <div data-testid="harness" />;
}

/** Minimal ``visualViewport`` stand-in (happy-dom does not provide one). */
class VisualViewportStub extends EventTarget {
    height: number;
    scale: number;

    constructor(height: number, scale = 1) {
        super();
        this.height = height;
        this.scale = scale;
    }
}

const LAYOUT_HEIGHT = 800;

let viewport: VisualViewportStub;
let scrollToSpy: ReturnType<typeof vi.fn>;

function setWindowScroll(x: number, y: number) {
    Object.defineProperty(window, "scrollX", { value: x, configurable: true });
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
}

beforeEach(() => {
    viewport = new VisualViewportStub(LAYOUT_HEIGHT);
    Object.defineProperty(window, "visualViewport", {
        value: viewport,
        configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
        value: LAYOUT_HEIGHT,
        configurable: true,
    });
    scrollToSpy = vi.fn();
    vi.stubGlobal("scrollTo", scrollToSpy);
    setWindowScroll(0, 0);
});

afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "visualViewport", {
        value: undefined,
        configurable: true,
    });
});

describe("useVisualViewportRealign (#1569)", () => {
    it("resets a phantom window scroll once the keyboard is closed", () => {
        // Repro: iOS scrolled the window by ~2 lines to reveal an input,
        // then the keyboard closed — the offset would linger forever.
        render(<Harness />);
        setWindowScroll(0, 48);
        act(() => {
            viewport.dispatchEvent(new Event("resize"));
        });
        expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });

    it("also realigns on visualViewport scroll and on focusout", () => {
        render(<Harness />);
        setWindowScroll(0, 32);
        act(() => {
            viewport.dispatchEvent(new Event("scroll"));
        });
        expect(scrollToSpy).toHaveBeenCalledTimes(1);
        setWindowScroll(16, 0);
        act(() => {
            window.dispatchEvent(new Event("focusout"));
        });
        expect(scrollToSpy).toHaveBeenCalledTimes(2);
    });

    it("never resets while the keyboard is open (Safari owns the reveal scroll)", () => {
        render(<Harness />);
        // Keyboard shrinks the visual viewport well past the 150px threshold.
        viewport.height = LAYOUT_HEIGHT - 300;
        setWindowScroll(0, 120);
        act(() => {
            viewport.dispatchEvent(new Event("resize"));
        });
        expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("treats an address-bar-sized shrink as keyboard-closed (boundary)", () => {
        render(<Harness />);
        // 60px is browser-UI territory, not a keyboard — realign proceeds.
        viewport.height = LAYOUT_HEIGHT - 60;
        setWindowScroll(0, 48);
        act(() => {
            viewport.dispatchEvent(new Event("resize"));
        });
        expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });

    it("never fights a user pinch-zoom (the #1570 flaw)", () => {
        render(<Harness />);
        // Pinch-zoom lowers visualViewport.height AND raises .scale; a
        // scroll reset here would yank the zoomed viewport around.
        viewport.height = LAYOUT_HEIGHT / 2;
        viewport.scale = 2;
        setWindowScroll(0, 200);
        act(() => {
            viewport.dispatchEvent(new Event("resize"));
        });
        expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("is a no-op when the window is already aligned", () => {
        render(<Harness />);
        act(() => {
            viewport.dispatchEvent(new Event("resize"));
        });
        expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("does nothing without a visualViewport (desktop engines, old stubs)", () => {
        Object.defineProperty(window, "visualViewport", {
            value: undefined,
            configurable: true,
        });
        expect(() => render(<Harness />)).not.toThrow();
    });

    it("removes its listeners on unmount", () => {
        const addSpy = vi.spyOn(viewport, "addEventListener");
        const removeSpy = vi.spyOn(viewport, "removeEventListener");
        const { unmount } = render(<Harness />);
        expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
        expect(addSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
        unmount();
        expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
        // The lingering listener would keep resetting after unmount.
        setWindowScroll(0, 48);
        scrollToSpy.mockClear();
        viewport.dispatchEvent(new Event("resize"));
        expect(scrollToSpy).not.toHaveBeenCalled();
    });
});
