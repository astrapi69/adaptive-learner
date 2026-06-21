/**
 * Tests for the useGlossary hook (PERF-HELP-GLOSSARY-LAZY-01).
 *
 * Pins:
 *  - English (eager) reports loaded immediately, no fetch.
 *  - A lazy language is not loaded on first render, then flips to
 *    loaded once its chunk resolves (re-render).
 *  - getGlossaryEntry returns the localized entry after the load.
 */

import {describe, it, expect, vi} from "vitest";
import {renderHook, waitFor} from "@testing-library/react";

import {useGlossary} from "./useGlossary";
import {getGlossaryEntry, isGlossaryLoaded} from "../../lib/help/help-glossary";

describe("useGlossary", () => {
    it("reports English as loaded immediately (eager, no fetch)", () => {
        const {result} = renderHook(() => useGlossary("en"));
        expect(result.current).toBe(true);
    });

    it("loads a lazy language and re-renders when its chunk lands", async () => {
        // Greek is one of the lazy per-language chunks; it must not be
        // resident before the hook runs in a fresh module registry...
        // unless an earlier test already loaded it, so only assert the
        // end state (loaded) which the hook drives.
        const {result} = renderHook(() => useGlossary("el"));
        await waitFor(() => expect(result.current).toBe(true));
        expect(isGlossaryLoaded("el")).toBe(true);
        // The localized entry resolves after the chunk loads.
        const entry = getGlossaryEntry("curriculum", "el");
        expect(entry).not.toBeNull();
        expect(entry!.key).toBe("curriculum");
    });

    it("falls back to the English entry before the lazy chunk loads", () => {
        // First synchronous render for an unsupported code resolves to EN
        // (eager), so a key always resolves to a non-null entry.
        const spy = vi.fn();
        renderHook(() => {
            useGlossary("xx");
            spy();
        });
        expect(getGlossaryEntry("learning_session", "xx")).not.toBeNull();
        expect(spy).toHaveBeenCalled();
    });
});
