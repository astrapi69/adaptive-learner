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

import { clearVvLog, readVvLog } from "../../lib/diagnostics/vv-log";
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

    it("never resets while a text field holds focus, even when the shrink reads 0 (#2983)", () => {
        // Measured on iOS 18.7 (reading 5): with interactive-widget=
        // resizes-content the keyboard-open state ALSO appears as
        // innerHeight === vv.height (both shrunk), so the shrink guard
        // reads 0 and the old hook fired scrollTo(0,0) into Safari's
        // reveal — the logged oscillation. The focused text field is the
        // representation-independent signal.
        const { getByTestId } = render(
            <>
                <Harness />
                <input data-testid="field" />
            </>,
        );
        (getByTestId("field") as HTMLInputElement).focus();
        // Resized representation: layout viewport shrunk to the visual one.
        viewport.height = LAYOUT_HEIGHT;
        setWindowScroll(0, 474);
        act(() => {
            viewport.dispatchEvent(new Event("resize"));
        });
        expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("a focus move between two fields does not realign (#2983)", () => {
        render(<Harness />);
        setWindowScroll(0, 87);
        const nextField = document.createElement("input");
        document.body.appendChild(nextField);
        try {
            act(() => {
                window.dispatchEvent(
                    new FocusEvent("focusout", { relatedTarget: nextField }),
                );
            });
            expect(scrollToSpy).not.toHaveBeenCalled();
        } finally {
            nextField.remove();
        }
    });

    it("still realigns once the field is blurred for good (#2983)", () => {
        render(<Harness />);
        setWindowScroll(0, 87);
        act(() => {
            window.dispatchEvent(new FocusEvent("focusout", { relatedTarget: null }));
        });
        expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });

    it("non-text-entry focus (a checkbox) does not block the realign (#2983)", () => {
        const { getByTestId } = render(
            <>
                <Harness />
                <input type="checkbox" data-testid="check" />
            </>,
        );
        (getByTestId("check") as HTMLInputElement).focus();
        setWindowScroll(0, 48);
        act(() => {
            viewport.dispatchEvent(new Event("resize"));
        });
        expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
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

    it("logs its decisions to the protocol while the probe is enabled (#2995)", () => {
        localStorage.setItem("adaptive-learner.vv_diag", "1");
        clearVvLog();
        try {
            render(<Harness />);
            // A due reset fires and is recorded with the pre-reset state.
            setWindowScroll(0, 48);
            act(() => {
                viewport.dispatchEvent(new Event("resize"));
            });
            const logged = readVvLog().filter((e) => e.kind === "hook");
            expect(logged).toHaveLength(1);
            expect(logged[0].decision).toBe("reset");
            expect(logged[0].winY).toBe(48);
        } finally {
            clearVvLog();
            localStorage.removeItem("adaptive-learner.vv_diag");
        }
    });

    it("logs a held reset once, not per scroll event (#2995)", () => {
        localStorage.setItem("adaptive-learner.vv_diag", "1");
        clearVvLog();
        try {
            const { getByTestId } = render(
                <>
                    <Harness />
                    <input data-testid="field" />
                </>,
            );
            (getByTestId("field") as HTMLInputElement).focus();
            setWindowScroll(0, 253);
            act(() => {
                viewport.dispatchEvent(new Event("scroll"));
                viewport.dispatchEvent(new Event("scroll"));
                viewport.dispatchEvent(new Event("scroll"));
            });
            const logged = readVvLog().filter((e) => e.kind === "hook");
            expect(logged).toHaveLength(1);
            expect(logged[0].decision).toBe("hold:focus");
        } finally {
            clearVvLog();
            localStorage.removeItem("adaptive-learner.vv_diag");
        }
    });

    it("logs nothing while the probe is disabled (#2995)", () => {
        clearVvLog();
        render(<Harness />);
        setWindowScroll(0, 48);
        act(() => {
            viewport.dispatchEvent(new Event("resize"));
        });
        expect(readVvLog()).toHaveLength(0);
        // The realign itself still works — logging is observation only.
        expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
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
