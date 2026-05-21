/**
 * useSwipe tests (Phase 23A).
 *
 * Drives synthetic TouchEvent instances against a real DOM node
 * to verify the gesture-detection contract:
 *
 *  - threshold crossing
 *  - velocity gate
 *  - vertical-intent rejection
 *  - prefers-reduced-motion threshold bump
 *  - enabled=false disables the hook
 *  - cleanup removes every listener
 */

import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {hapticSwipe, useSwipe} from "./useSwipe";

interface TouchPoint {
    clientX: number;
    clientY: number;
}

function makeTouchEvent(type: string, touches: TouchPoint[]): TouchEvent {
    const ev = new Event(type, {bubbles: true, cancelable: true}) as TouchEvent;
    // happy-dom does not give us a constructable TouchEvent; we
    // simulate the .touches list with a plain array. The hook only
    // reads ``event.touches[0]``.
    (ev as unknown as {touches: TouchPoint[]}).touches = touches;
    return ev;
}

interface SimulateOptions {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    durationMs?: number;
}

function simulateSwipe(node: HTMLElement, opts: SimulateOptions): void {
    const duration = opts.durationMs ?? 100;
    node.dispatchEvent(
        makeTouchEvent("touchstart", [{clientX: opts.fromX, clientY: opts.fromY}]),
    );
    // Advance the mocked clock if vi.useFakeTimers is active.
    vi.advanceTimersByTime(duration);
    node.dispatchEvent(
        makeTouchEvent("touchmove", [{clientX: opts.toX, clientY: opts.toY}]),
    );
    node.dispatchEvent(makeTouchEvent("touchend", []));
}

function attachHook(
    options: Parameters<typeof useSwipe>[0],
): {node: HTMLDivElement; unmount: () => void} {
    const node = document.createElement("div");
    document.body.appendChild(node);
    const {result, unmount} = renderHook(() => useSwipe<HTMLDivElement>(options));
    // Attach the ref to our node and re-render the hook so the
    // effect picks the node up.
    act(() => {
        (result.current.ref as unknown as {current: HTMLElement}).current = node;
    });
    // Force a re-render so the useEffect re-runs against the new ref.
    // The hook deps don't include the ref, so we trigger by toggling
    // enabled via re-render isn't trivial here. Instead, we
    // re-attach by re-rendering the hook with same options:
    // The simpler path: render the hook AFTER node is set. So
    // skip the manual attach and use the alt path below.
    return {node, unmount};
}

describe("useSwipe", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Default: no reduced-motion preference.
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: (q: string) => ({
                matches: false,
                media: q,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                onchange: null,
                dispatchEvent: vi.fn(),
            }),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = "";
    });

    /**
     * Wire the hook ref to a node, then re-render so the effect
     * attaches its listeners against the real DOM node. Returns
     * the node + unmount.
     */
    function setup(
        options: Parameters<typeof useSwipe>[0],
    ): {node: HTMLDivElement; unmount: () => void; rerender: () => void} {
        const node = document.createElement("div");
        document.body.appendChild(node);
        let attached = false;
        const {result, unmount, rerender} = renderHook(() => {
            const hook = useSwipe<HTMLDivElement>(options);
            if (!attached) {
                (hook.ref as unknown as {current: HTMLElement | null}).current =
                    node;
            }
            return hook;
        });
        attached = true;
        // Re-render so useEffect with the now-populated ref attaches.
        rerender();
        // Reference the result to silence the unused-var lint.
        void result;
        return {node, unmount, rerender: () => rerender()};
    }

    it("fires onSwipeLeft when finger moves left fast enough beyond threshold", () => {
        const onSwipeLeft = vi.fn();
        const onSwipeRight = vi.fn();
        const {node} = setup({onSwipeLeft, onSwipeRight});
        simulateSwipe(node, {fromX: 200, fromY: 100, toX: 100, toY: 100, durationMs: 50});
        expect(onSwipeLeft).toHaveBeenCalledTimes(1);
        expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it("fires onSwipeRight when finger moves right beyond threshold", () => {
        const onSwipeLeft = vi.fn();
        const onSwipeRight = vi.fn();
        const {node} = setup({onSwipeLeft, onSwipeRight});
        simulateSwipe(node, {fromX: 50, fromY: 100, toX: 200, toY: 100, durationMs: 50});
        expect(onSwipeRight).toHaveBeenCalledTimes(1);
        expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it("does not fire when horizontal distance is below threshold", () => {
        const onSwipeLeft = vi.fn();
        const onSwipeRight = vi.fn();
        const {node} = setup({onSwipeLeft, onSwipeRight, threshold: 50});
        simulateSwipe(node, {fromX: 100, fromY: 100, toX: 120, toY: 100, durationMs: 50});
        expect(onSwipeLeft).not.toHaveBeenCalled();
        expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it("does not fire when vertical distance exceeds horizontal (scroll intent)", () => {
        const onSwipeLeft = vi.fn();
        const {node} = setup({onSwipeLeft});
        // dx = -80, dy = -200. The user is scrolling, not swiping.
        simulateSwipe(node, {fromX: 200, fromY: 300, toX: 120, toY: 100, durationMs: 50});
        expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it("does not fire when the swipe is too slow (velocity gate)", () => {
        const onSwipeRight = vi.fn();
        const {node} = setup({onSwipeRight, threshold: 50});
        // 200 px in 2000 ms = 0.1 px/ms — below the default 0.15.
        simulateSwipe(node, {fromX: 50, fromY: 100, toX: 250, toY: 100, durationMs: 2000});
        expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it("doubles the threshold when prefers-reduced-motion is set", () => {
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: (q: string) => ({
                matches: q.includes("prefers-reduced-motion"),
                media: q,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                onchange: null,
                dispatchEvent: vi.fn(),
            }),
        });
        const onSwipeRight = vi.fn();
        const {node} = setup({onSwipeRight});
        // 70 px clears the 50-px default but NOT the 100-px reduced threshold.
        simulateSwipe(node, {fromX: 50, fromY: 100, toX: 120, toY: 100, durationMs: 50});
        expect(onSwipeRight).not.toHaveBeenCalled();
        // 150 px clears the 100-px threshold.
        simulateSwipe(node, {fromX: 50, fromY: 100, toX: 200, toY: 100, durationMs: 50});
        expect(onSwipeRight).toHaveBeenCalledTimes(1);
    });

    it("does not attach listeners when enabled=false", () => {
        const onSwipeLeft = vi.fn();
        const {node} = setup({onSwipeLeft, enabled: false});
        simulateSwipe(node, {fromX: 200, fromY: 100, toX: 50, toY: 100, durationMs: 50});
        expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it("cleans up listeners on unmount", () => {
        const onSwipeLeft = vi.fn();
        const {node, unmount} = setup({onSwipeLeft});
        unmount();
        simulateSwipe(node, {fromX: 200, fromY: 100, toX: 50, toY: 100, durationMs: 50});
        expect(onSwipeLeft).not.toHaveBeenCalled();
    });
});

describe("hapticSwipe", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("calls navigator.vibrate(10) when available", () => {
        const vibrate = vi.fn();
        Object.defineProperty(navigator, "vibrate", {
            configurable: true,
            value: vibrate,
        });
        hapticSwipe();
        expect(vibrate).toHaveBeenCalledWith(10);
    });

    it("no-ops when navigator.vibrate is absent", () => {
        Object.defineProperty(navigator, "vibrate", {
            configurable: true,
            value: undefined,
        });
        expect(() => hapticSwipe()).not.toThrow();
    });
});
