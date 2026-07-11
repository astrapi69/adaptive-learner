/**
 * Tests for useVisualViewportShell (#1569).
 *
 * The hook binds the app-shell height to the *visual* viewport while the
 * software keyboard is open, so the layout and visual viewports coincide and
 * the iOS hit-test grid / caret realign with the rendering (the "caret/touch
 * lands 1-2 lines below the field" bug). Pins the deterministic mechanism —
 * the native hit-test resolution itself is device-only and cannot be asserted
 * in happy-dom.
 *
 * Pins:
 *  - no-op (no override) when window.visualViewport is absent,
 *  - keyboard-open (visual viewport much shorter than layout) publishes the
 *    --app-shell-height override + the data-vv-keyboard="open" marker,
 *  - keyboard-close clears both,
 *  - an address-bar-sized shrink (below the keyboard threshold) does NOT
 *    engage the override (dvh already handles it — do not fight it),
 *  - unmount removes the override, the marker, and the listeners.
 */

import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {useVisualViewportShell} from "./useVisualViewportShell";

interface FakeVisualViewport {
    height: number;
    offsetTop: number;
    addEventListener: (type: string, cb: () => void) => void;
    removeEventListener: (type: string, cb: () => void) => void;
    _emit: () => void;
    _listenerCount: () => number;
}

function makeVisualViewport(height: number): FakeVisualViewport {
    const listeners = new Set<() => void>();
    return {
        height,
        offsetTop: 0,
        addEventListener: (_type, cb) => listeners.add(cb),
        removeEventListener: (_type, cb) => listeners.delete(cb),
        _emit: () => listeners.forEach((cb) => cb()),
        _listenerCount: () => listeners.size,
    };
}

const LAYOUT_HEIGHT = 800;

function readOverride(): string {
    return document.documentElement.style.getPropertyValue("--app-shell-height");
}

function readMarker(): string | null {
    return document.documentElement.getAttribute("data-vv-keyboard");
}

describe("useVisualViewportShell", () => {
    let originalVV: unknown;

    beforeEach(() => {
        originalVV = (window as unknown as {visualViewport: unknown}).visualViewport;
        vi.spyOn(window, "innerHeight", "get").mockReturnValue(LAYOUT_HEIGHT);
    });

    afterEach(() => {
        (window as unknown as {visualViewport: unknown}).visualViewport = originalVV;
        document.documentElement.style.removeProperty("--app-shell-height");
        document.documentElement.removeAttribute("data-vv-keyboard");
        vi.restoreAllMocks();
    });

    function setViewport(vv: FakeVisualViewport | undefined): void {
        (window as unknown as {visualViewport: unknown}).visualViewport = vv;
    }

    it("is a no-op when visualViewport is unavailable", () => {
        setViewport(undefined);
        renderHook(() => useVisualViewportShell());
        expect(readOverride()).toBe("");
        expect(readMarker()).toBeNull();
    });

    it("publishes the shell-height override + marker when the keyboard opens", () => {
        const vv = makeVisualViewport(LAYOUT_HEIGHT);
        setViewport(vv);
        renderHook(() => useVisualViewportShell());
        // No keyboard yet.
        expect(readMarker()).toBeNull();

        // Keyboard opens: the visual viewport shrinks well past the threshold.
        vv.height = 460;
        act(() => vv._emit());

        expect(readOverride()).toBe("460px");
        expect(readMarker()).toBe("open");
    });

    it("clears the override + marker when the keyboard closes", () => {
        const vv = makeVisualViewport(LAYOUT_HEIGHT);
        setViewport(vv);
        renderHook(() => useVisualViewportShell());

        vv.height = 460;
        act(() => vv._emit());
        expect(readMarker()).toBe("open");

        vv.height = LAYOUT_HEIGHT;
        act(() => vv._emit());
        expect(readOverride()).toBe("");
        expect(readMarker()).toBeNull();
    });

    it("ignores an address-bar-sized shrink below the keyboard threshold", () => {
        const vv = makeVisualViewport(LAYOUT_HEIGHT);
        setViewport(vv);
        renderHook(() => useVisualViewportShell());

        // ~90px shrink: browser-UI change, already tracked by dvh — must NOT
        // engage the override (fighting dvh would cause a layout flicker).
        vv.height = LAYOUT_HEIGHT - 90;
        act(() => vv._emit());

        expect(readOverride()).toBe("");
        expect(readMarker()).toBeNull();
    });

    it("removes the override, marker, and listeners on unmount", () => {
        const vv = makeVisualViewport(LAYOUT_HEIGHT);
        setViewport(vv);
        const {unmount} = renderHook(() => useVisualViewportShell());

        vv.height = 460;
        act(() => vv._emit());
        expect(readMarker()).toBe("open");
        expect(vv._listenerCount()).toBeGreaterThan(0);

        unmount();
        expect(readOverride()).toBe("");
        expect(readMarker()).toBeNull();
        expect(vv._listenerCount()).toBe(0);
    });
});
