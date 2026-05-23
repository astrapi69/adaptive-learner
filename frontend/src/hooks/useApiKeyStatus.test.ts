/**
 * Tests for the API-key status hook (Issue 4 / v1.23.1).
 *
 * The hook gates every AI-dependent button in the app. Three
 * properties matter most:
 *
 *   1. ``ready=false`` until the settings fetch resolves —
 *      buttons must not flicker "no key" before we know.
 *   2. ``hasKey`` reflects the ACTIVE provider's flag, not
 *      whichever provider happens to have any key set.
 *   3. ``refreshApiKeyStatus()`` re-fetches + notifies every
 *      mounted hook so Settings edits propagate without a
 *      hard reload.
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {
    _resetApiKeyStatusCacheForTests,
    refreshApiKeyStatus,
    useApiKeyStatus,
} from "./useApiKeyStatus";

const apiSettingsGet = vi.fn();
vi.mock("../api/client", async () => {
    const actual = await vi.importActual<typeof import("../api/client")>(
        "../api/client",
    );
    return {
        ...actual,
        api: {
            ...actual.api,
            settings: {
                ...actual.api.settings,
                get: (...args: unknown[]) => apiSettingsGet(...args),
            },
        },
    };
});

const BASE_SETTINGS = {
    user_id: "u-1",
    language: "de",
    timezone: "UTC",
    daily_goal_minutes: 30,
    active_provider: "anthropic",
    has_anthropic_key: false,
    has_openai_key: false,
    has_gemini_key: false,
    model_override_anthropic: null,
    model_override_openai: null,
    model_override_gemini: null,
    tts_enabled: false,
    stt_enabled: false,
    tts_voice: null,
    chat_streaming_enabled: true,
    auto_loop_enabled: true,
    method_switch_enabled: true,
    key_source_anthropic: "settings",
    key_source_openai: "settings",
    key_source_gemini: "settings",
    created_at: "2026-05-23T00:00:00Z",
    updated_at: "2026-05-23T00:00:00Z",
} as const;

describe("useApiKeyStatus", () => {
    beforeEach(() => {
        _resetApiKeyStatusCacheForTests();
        apiSettingsGet.mockReset();
        localStorage.clear();
        localStorage.setItem("adaptive-learner.user_id", "u-1");
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("starts not-ready, transitions to ready with hasKey reflecting the active provider", async () => {
        apiSettingsGet.mockResolvedValue({
            ...BASE_SETTINGS,
            active_provider: "anthropic",
            has_anthropic_key: true,
        });
        const {result} = renderHook(() => useApiKeyStatus());
        // Initial snapshot: not ready.
        expect(result.current.ready).toBe(false);
        expect(result.current.hasKey).toBe(false);
        await waitFor(() => {
            expect(result.current.ready).toBe(true);
        });
        expect(result.current.hasKey).toBe(true);
        expect(result.current.activeProvider).toBe("anthropic");
    });

    it("returns hasKey=false when the active provider's flag is false even if other providers have keys", async () => {
        // User configured an OpenAI key but their active
        // provider is Gemini — gating MUST check Gemini's
        // flag, not "does any provider have a key?".
        apiSettingsGet.mockResolvedValue({
            ...BASE_SETTINGS,
            active_provider: "gemini",
            has_anthropic_key: false,
            has_openai_key: true,
            has_gemini_key: false,
        });
        const {result} = renderHook(() => useApiKeyStatus());
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(result.current.hasKey).toBe(false);
        expect(result.current.activeProvider).toBe("gemini");
    });

    it("treats a fetch failure as ready=true + hasKey=false", async () => {
        const {ApiError} = await import("../api/client");
        apiSettingsGet.mockRejectedValue(new ApiError(500, "DB down"));
        const {result} = renderHook(() => useApiKeyStatus());
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(result.current.hasKey).toBe(false);
        // We don't claim to know the active provider in the
        // failure path.
        expect(result.current.activeProvider).toBe(null);
    });

    it("caches across components: a second mount does NOT re-fetch", async () => {
        apiSettingsGet.mockResolvedValue({
            ...BASE_SETTINGS,
            active_provider: "anthropic",
            has_anthropic_key: true,
        });
        const first = renderHook(() => useApiKeyStatus());
        await waitFor(() => expect(first.result.current.ready).toBe(true));
        expect(apiSettingsGet).toHaveBeenCalledTimes(1);
        // Second mount reads from the cache.
        const second = renderHook(() => useApiKeyStatus());
        expect(second.result.current.ready).toBe(true);
        expect(second.result.current.hasKey).toBe(true);
        expect(apiSettingsGet).toHaveBeenCalledTimes(1);
    });

    it("refreshApiKeyStatus() drops the cache and notifies subscribers", async () => {
        apiSettingsGet.mockResolvedValue({
            ...BASE_SETTINGS,
            active_provider: "anthropic",
            has_anthropic_key: false,
        });
        const {result} = renderHook(() => useApiKeyStatus());
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(result.current.hasKey).toBe(false);
        // User saves a key in Settings.
        apiSettingsGet.mockResolvedValue({
            ...BASE_SETTINGS,
            active_provider: "anthropic",
            has_anthropic_key: true,
        });
        await act(async () => {
            await refreshApiKeyStatus();
        });
        await waitFor(() => expect(result.current.hasKey).toBe(true));
        expect(apiSettingsGet).toHaveBeenCalledTimes(2);
    });
});
