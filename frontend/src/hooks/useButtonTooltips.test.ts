/**
 * Tests for the useButtonTooltips hook (Phase 38 accessibility
 * sweep).
 *
 * Pins:
 *  - Default ON when no preference stored.
 *  - Reads ``false`` from localStorage correctly.
 *  - ``setButtonTooltipsEnabled(false)`` updates localStorage
 *    + dispatches the change event + the hook re-renders.
 *  - ``useTooltipProps`` returns ``aria-label`` always; the
 *    ``title`` field is only present when tooltips are on.
 */

import {describe, it, expect, beforeEach} from "vitest";
import {act, renderHook} from "@testing-library/react";

import {
    setButtonTooltipsEnabled,
    useButtonTooltips,
    useTooltipProps,
} from "./useButtonTooltips";

beforeEach(() => {
    localStorage.clear();
});

describe("useButtonTooltips", () => {
    it("defaults to ON when localStorage is empty", () => {
        const {result} = renderHook(() => useButtonTooltips());
        expect(result.current).toBe(true);
    });

    it("returns false when the user opted out", () => {
        localStorage.setItem(
            "adaptive-learner.button_tooltips_enabled",
            "false",
        );
        const {result} = renderHook(() => useButtonTooltips());
        expect(result.current).toBe(false);
    });

    it("re-renders subscribers when setButtonTooltipsEnabled is called", () => {
        const {result} = renderHook(() => useButtonTooltips());
        expect(result.current).toBe(true);
        act(() => {
            setButtonTooltipsEnabled(false);
        });
        expect(result.current).toBe(false);
        act(() => {
            setButtonTooltipsEnabled(true);
        });
        expect(result.current).toBe(true);
    });

    it("persists the preference to localStorage", () => {
        setButtonTooltipsEnabled(false);
        expect(
            localStorage.getItem(
                "adaptive-learner.button_tooltips_enabled",
            ),
        ).toBe("false");
        setButtonTooltipsEnabled(true);
        expect(
            localStorage.getItem(
                "adaptive-learner.button_tooltips_enabled",
            ),
        ).toBe("true");
    });
});

describe("useTooltipProps", () => {
    it("returns aria-label + title when tooltips are on", () => {
        const {result} = renderHook(() => useTooltipProps("Delete"));
        expect(result.current).toEqual({
            "aria-label": "Delete",
            title: "Delete",
        });
    });

    it("returns only aria-label when tooltips are off", () => {
        localStorage.setItem(
            "adaptive-learner.button_tooltips_enabled",
            "false",
        );
        const {result} = renderHook(() => useTooltipProps("Delete"));
        expect(result.current).toEqual({"aria-label": "Delete"});
        expect("title" in result.current).toBe(false);
    });

    it("re-renders when the preference changes", () => {
        const {result, rerender} = renderHook(() =>
            useTooltipProps("Send message"),
        );
        expect(result.current.title).toBe("Send message");
        act(() => {
            setButtonTooltipsEnabled(false);
        });
        rerender();
        expect(result.current.title).toBeUndefined();
        expect(result.current["aria-label"]).toBe("Send message");
    });
});
