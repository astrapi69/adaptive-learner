/**
 * #1133 — a successful key Test saves + activates the key so AI features just
 * work (no separate Save click). Pins handleTestKey's auto-save behaviour.
 */

import {act, renderHook} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import type {UserSettings} from "../../types";

const testApiKey = vi.fn();
const setApiKey = vi.fn();
const update = vi.fn();
const backupApiKey = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({settings: {testApiKey, setApiKey, update, backupApiKey}}),
}));
vi.mock("./useApiKeyStatus", () => ({refreshApiKeyStatus: vi.fn(async () => {})}));
vi.mock("../ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fallback: string) => fallback, lang: "en"}),
}));
vi.mock("../../contexts/ConfirmContext", () => ({useConfirm: () => vi.fn()}));
vi.mock("../../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

import {useAiKeySettings} from "./useAiKeySettings";

function settingsFixture(over: Partial<UserSettings> = {}): UserSettings {
    return {
        user_id: "u1",
        active_provider: "anthropic",
        has_anthropic_key: false,
        has_openai_key: false,
        has_gemini_key: false,
        ...over,
    } as unknown as UserSettings;
}

beforeEach(() => {
    testApiKey.mockReset();
    setApiKey.mockReset();
    update.mockReset();
    backupApiKey.mockReset();
});

describe("useAiKeySettings.handleTestKey auto-save (#1133)", () => {
    it("saves + backs up the drafted key when the test succeeds (active provider)", async () => {
        testApiKey.mockResolvedValue({success: true});
        setApiKey.mockResolvedValue(
            settingsFixture({has_anthropic_key: true}),
        );
        const onChange = vi.fn();
        const {result} = renderHook(() =>
            useAiKeySettings(settingsFixture(), onChange),
        );

        act(() => result.current.setKeyDrafts((p) => ({...p, anthropic: " sk-key "})));
        await act(async () => {
            await result.current.handleTestKey("anthropic");
        });

        expect(setApiKey).toHaveBeenCalledWith("u1", {provider: "anthropic", key: "sk-key"});
        expect(backupApiKey).toHaveBeenCalledWith("u1", {provider: "anthropic", key: "sk-key"});
        expect(onChange).toHaveBeenCalled();
        // active is already this provider -> no active_provider switch needed.
        expect(update).not.toHaveBeenCalled();
    });

    it("activates the provider when the active one has no key yet", async () => {
        testApiKey.mockResolvedValue({success: true});
        setApiKey.mockResolvedValue(
            settingsFixture({active_provider: "anthropic", has_openai_key: true}),
        );
        update.mockResolvedValue(
            settingsFixture({active_provider: "openai", has_openai_key: true}),
        );
        const {result} = renderHook(() =>
            useAiKeySettings(settingsFixture(), vi.fn()),
        );

        act(() => result.current.setKeyDrafts((p) => ({...p, openai: "sk-o"})));
        await act(async () => {
            await result.current.handleTestKey("openai");
        });

        expect(setApiKey).toHaveBeenCalledWith("u1", {provider: "openai", key: "sk-o"});
        expect(update).toHaveBeenCalledWith("u1", {active_provider: "openai"});
    });

    it("does NOT save when the test fails", async () => {
        testApiKey.mockResolvedValue({success: false, kind: "invalid"});
        const {result} = renderHook(() =>
            useAiKeySettings(settingsFixture(), vi.fn()),
        );

        act(() => result.current.setKeyDrafts((p) => ({...p, anthropic: "bad"})));
        await act(async () => {
            await result.current.handleTestKey("anthropic");
        });

        expect(setApiKey).not.toHaveBeenCalled();
        expect(backupApiKey).not.toHaveBeenCalled();
    });
});
