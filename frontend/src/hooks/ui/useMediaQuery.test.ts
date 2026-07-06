/**
 * useMediaQuery (#1390) — the viewport gate behind the one-primary-nav-per-
 * viewport rule. Pins: initial snapshot, live updates on a media flip,
 * listener cleanup on unmount, and the no-matchMedia fallback.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { stubMatchMedia, type MatchMediaStub } from "../../test-utils/match-media-stub";
import { useMediaQuery } from "./useMediaQuery";

const QUERY = "(max-width: 768px)";

describe("useMediaQuery", () => {
    let media: MatchMediaStub | null = null;

    afterEach(() => {
        media?.restore();
        media = null;
    });

    it("returns the current match state on first render (happy path)", () => {
        media = stubMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery(QUERY));
        expect(result.current).toBe(true);
    });

    it("re-renders when the media query flips at runtime", () => {
        media = stubMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery(QUERY));
        expect(result.current).toBe(false);
        act(() => media!.set(true));
        expect(result.current).toBe(true);
        act(() => media!.set(false));
        expect(result.current).toBe(false);
    });

    it("removes its change listener on unmount (boundary: no leak)", () => {
        media = stubMatchMedia(false);
        const { unmount } = renderHook(() => useMediaQuery(QUERY));
        expect(media.listenerCount()).toBe(1);
        unmount();
        expect(media.listenerCount()).toBe(0);
    });

    it("falls back to false when matchMedia is unavailable (edge case)", () => {
        const original = window.matchMedia;
        // @ts-expect-error — simulate an environment without matchMedia.
        window.matchMedia = undefined;
        try {
            const { result } = renderHook(() => useMediaQuery(QUERY));
            expect(result.current).toBe(false);
        } finally {
            window.matchMedia = original;
        }
    });
});
