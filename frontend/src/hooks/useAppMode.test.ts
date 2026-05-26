/**
 * Tests for the useAppMode hook (Phase 43 / EXP-005 / P-113).
 *
 * Pure interpretation layer over ``useApiKeyStatus``: the
 * mode is ``ai-augmented`` when an API key is present and
 * ``content-only`` when it isn't. The underlying hook's
 * caching + refresh semantics are pinned in its own test
 * file; this one just confirms the mapping.
 */

import {describe, expect, it, vi} from "vitest";
import {renderHook} from "@testing-library/react";

import {useAppMode} from "./useAppMode";

vi.mock("./useApiKeyStatus", () => ({
    useApiKeyStatus: vi.fn(),
}));

import {useApiKeyStatus} from "./useApiKeyStatus";

describe("useAppMode", () => {
    it("returns content-only when there's no API key", () => {
        vi.mocked(useApiKeyStatus).mockReturnValue({
            ready: true,
            hasKey: false,
            activeProvider: null,
            refresh: vi.fn(),
        });
        const {result} = renderHook(() => useAppMode());
        expect(result.current.ready).toBe(true);
        expect(result.current.mode).toBe("content-only");
    });

    it("returns ai-augmented when the active provider has a key", () => {
        vi.mocked(useApiKeyStatus).mockReturnValue({
            ready: true,
            hasKey: true,
            activeProvider: "anthropic",
            refresh: vi.fn(),
        });
        const {result} = renderHook(() => useAppMode());
        expect(result.current.mode).toBe("ai-augmented");
    });

    it("falls through ready=false from the underlying hook", () => {
        vi.mocked(useApiKeyStatus).mockReturnValue({
            ready: false,
            hasKey: false,
            activeProvider: null,
            refresh: vi.fn(),
        });
        const {result} = renderHook(() => useAppMode());
        expect(result.current.ready).toBe(false);
        // Before ready: defaults to content-only (the safe
        // assumption — never claim AI is available before we
        // know).
        expect(result.current.mode).toBe("content-only");
    });
});
