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

    it("is a no-op (stays 'top') when the container is absent", () => {
        root.remove();
        const {result} = renderHook(() => useScrollDirection());
        scrollTo(root, 100); // detached element — no listener attached
        expect(result.current).toBe("top");
    });
});
