/**
 * Tests for useScrollDirection (lesson header auto-hide).
 *
 * Pins:
 *  - starts at "top",
 *  - "down" after scrolling down past the threshold,
 *  - "up" after scrolling back up past the threshold,
 *  - "top" at/under the threshold regardless of prior direction,
 *  - sub-threshold jitter does not flip the direction,
 *  - no-op (stays "top") when the scroll container is absent.
 */

import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {useScrollDirection} from "./useScrollDirection";

function makeRoot(): HTMLElement {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
    return root;
}

function scrollTo(root: HTMLElement, y: number): void {
    root.scrollTop = y;
    act(() => {
        root.dispatchEvent(new Event("scroll"));
    });
}

describe("useScrollDirection", () => {
    let root: HTMLElement;

    beforeEach(() => {
        root = makeRoot();
    });

    afterEach(() => {
        root.remove();
    });

    it("starts at 'top'", () => {
        const {result} = renderHook(() => useScrollDirection());
        expect(result.current).toBe("top");
    });

    it("reports 'down' when scrolling down past the threshold", () => {
        const {result} = renderHook(() => useScrollDirection(10));
        scrollTo(root, 100);
        expect(result.current).toBe("down");
    });

    it("reports 'up' when scrolling back up past the threshold", () => {
        const {result} = renderHook(() => useScrollDirection(10));
        scrollTo(root, 100); // down
        scrollTo(root, 40); // up by 60 (> threshold)
        expect(result.current).toBe("up");
    });

    it("reports 'top' once back at/under the threshold", () => {
        const {result} = renderHook(() => useScrollDirection(10));
        scrollTo(root, 100); // down
        scrollTo(root, 5); // <= threshold
        expect(result.current).toBe("top");
    });

    it("ignores sub-threshold jitter (keeps the current direction)", () => {
        const {result} = renderHook(() => useScrollDirection(10));
        scrollTo(root, 100); // down
        scrollTo(root, 103); // +3 (< threshold) and > threshold from top
        expect(result.current).toBe("down");
    });

    it("commits 'down' for small incremental scrolls that accumulate past the threshold", () => {
        // Regression (P1): real momentum scrolling fires many small deltas.
        // The reference must NOT advance on every event, or a slow scroll
        // never accumulates past the threshold and the header never hides.
        const {result} = renderHook(() => useScrollDirection(10));
        scrollTo(root, 6); // still "top" (<= threshold)
        scrollTo(root, 12); // +6 since the last commit (ref=6) -> no commit yet
        expect(result.current).toBe("top");
        scrollTo(root, 18); // +12 since ref=6 -> crosses threshold -> "down"
        expect(result.current).toBe("down");
    });

    it("commits 'up' for small incremental upward scrolls", () => {
        const {result} = renderHook(() => useScrollDirection(10));
        scrollTo(root, 100); // down (ref=100)
        scrollTo(root, 95); // -5 (< threshold) -> no commit
        scrollTo(root, 88); // -12 since ref=100 -> "up"
        expect(result.current).toBe("up");
    });

    it("is a no-op (stays 'top') when the container is absent", () => {
        root.remove();
        const {result} = renderHook(() => useScrollDirection());
        scrollTo(root, 100); // detached element — no listener attached
        expect(result.current).toBe("top");
    });
});
