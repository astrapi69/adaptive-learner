/**
 * Tests for the key-vault payload helpers (EXP-038).
 */

import { describe, expect, it } from "vitest";

import {
    buildKeyVaultPayload,
    hasExportableKey,
    isKeyVaultPayload,
    presentKeys,
} from "./key-vault";

const SETTINGS = {
    active_provider: "anthropic" as const,
    model_override_anthropic: "claude-x",
    model_override_openai: null,
    model_override_gemini: null,
};

describe("key-vault payload", () => {
    it("presentKeys keeps only non-empty keys", () => {
        expect(
            presentKeys({ anthropic: "k", openai: "", gemini: "  " }),
        ).toEqual({ anthropic: "k" });
    });

    it("hasExportableKey reflects whether any key is present", () => {
        expect(hasExportableKey({})).toBe(false);
        expect(hasExportableKey({ openai: "" })).toBe(false);
        expect(hasExportableKey({ openai: "sk" })).toBe(true);
    });

    it("buildKeyVaultPayload carries present keys + provider settings", () => {
        const payload = buildKeyVaultPayload(
            { anthropic: "sk-a", gemini: "" },
            SETTINGS,
        );
        expect(payload.keys).toEqual({ anthropic: "sk-a" });
        expect(payload.providerSettings).toEqual({
            active_provider: "anthropic",
            model_override_anthropic: "claude-x",
            model_override_openai: null,
            model_override_gemini: null,
        });
    });

    it("isKeyVaultPayload accepts a valid shape and rejects others", () => {
        expect(
            isKeyVaultPayload({
                keys: { anthropic: "k" },
                providerSettings: {},
            }),
        ).toBe(true);
        expect(isKeyVaultPayload({ hello: "world" })).toBe(false);
        // A non-provider key, or a non-string key value, is rejected.
        expect(
            isKeyVaultPayload({ keys: { evil: "k" }, providerSettings: {} }),
        ).toBe(false);
        expect(
            isKeyVaultPayload({ keys: { anthropic: 1 }, providerSettings: {} }),
        ).toBe(false);
    });
});
