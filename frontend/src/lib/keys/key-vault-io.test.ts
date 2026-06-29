/**
 * Tests for the key-vault export/import orchestration (EXP-038).
 *
 * Pins the round-trip (export → clear → import → restored), the wrong-passphrase
 * and corrupt-file rejections with NO partial import, the no-keys gate, and the
 * separation guarantee (the `.alk` carries no plaintext key; the normal `.alb`
 * still strips keys from user_settings).
 */

import { describe, expect, it } from "vitest";

import {
    buildEncryptedKeyVault,
    importEncryptedKeyVault,
} from "./key-vault-io";
import { VaultDecryptError } from "../crypto/passphrase-vault";
import { EXCLUDED_USER_SETTINGS_FIELDS } from "../../storage/backup/backup";
import type { AIProvider } from "../constants";
import type { ISettingsNamespace } from "../../storage/types";

interface FakeState {
    keys: Partial<Record<AIProvider, string>>;
    active_provider: AIProvider;
    model_override_anthropic: string | null;
    model_override_openai: string | null;
    model_override_gemini: string | null;
}

/** Minimal in-memory settings namespace — only the methods the key vault uses
 *  are implemented; the rest are never called. */
function makeFakeSettings(seed: Partial<FakeState> = {}): {
    settings: ISettingsNamespace;
    state: FakeState;
} {
    const state: FakeState = {
        keys: { ...(seed.keys ?? {}) },
        active_provider: seed.active_provider ?? "anthropic",
        model_override_anthropic: seed.model_override_anthropic ?? null,
        model_override_openai: seed.model_override_openai ?? null,
        model_override_gemini: seed.model_override_gemini ?? null,
    };
    const settings = {
        exportApiKeys: async () => ({ ...state.keys }),
        get: async () =>
            ({
                active_provider: state.active_provider,
                model_override_anthropic: state.model_override_anthropic,
                model_override_openai: state.model_override_openai,
                model_override_gemini: state.model_override_gemini,
            }) as unknown,
        setApiKey: async (_uid: string, body: { provider: AIProvider; key: string }) => {
            state.keys[body.provider] = body.key;
            return {} as unknown;
        },
        update: async (_uid: string, body: Record<string, unknown>) => {
            if (typeof body.active_provider === "string") {
                state.active_provider = body.active_provider as AIProvider;
            }
            for (const p of ["anthropic", "openai", "gemini"] as const) {
                const field = `model_override_${p}` as const;
                if (field in body) {
                    const v = body[field];
                    state[field] = v === "" ? null : (v as string | null);
                }
            }
            return {} as unknown;
        },
    } as unknown as ISettingsNamespace;
    return { settings, state };
}

const PASS = "correct horse battery staple";

describe("key-vault-io", () => {
    it("round-trips keys + provider settings through an encrypted file", async () => {
        const src = makeFakeSettings({
            keys: { anthropic: "sk-ant-AAA", openai: "sk-oai-BBB" },
            active_provider: "openai",
            model_override_openai: "gpt-x",
        });
        const envelope = await buildEncryptedKeyVault(src.settings, "u1", PASS);
        expect(envelope).not.toBeNull();
        // Security: the keys are never in the file as plaintext.
        expect(envelope).not.toContain("sk-ant-AAA");
        expect(envelope).not.toContain("sk-oai-BBB");

        // Fresh device — empty storage.
        const dst = makeFakeSettings();
        const result = await importEncryptedKeyVault(
            dst.settings,
            "u2",
            envelope as string,
            PASS,
        );
        expect(result.providers.sort()).toEqual(["anthropic", "openai"]);
        expect(dst.state.keys).toEqual({
            anthropic: "sk-ant-AAA",
            openai: "sk-oai-BBB",
        });
        expect(dst.state.active_provider).toBe("openai");
        expect(dst.state.model_override_openai).toBe("gpt-x");
    });

    it("returns null when there is no exportable key (export gate)", async () => {
        const src = makeFakeSettings({ keys: {} });
        expect(await buildEncryptedKeyVault(src.settings, "u1", PASS)).toBeNull();
    });

    it("rejects a wrong passphrase with no partial import", async () => {
        const src = makeFakeSettings({ keys: { anthropic: "sk-ant-AAA" } });
        const envelope = (await buildEncryptedKeyVault(
            src.settings,
            "u1",
            PASS,
        )) as string;
        const dst = makeFakeSettings();
        await expect(
            importEncryptedKeyVault(dst.settings, "u2", envelope, "WRONG"),
        ).rejects.toBeInstanceOf(VaultDecryptError);
        // Nothing was written.
        expect(dst.state.keys).toEqual({});
    });

    it("rejects a corrupted file", async () => {
        const dst = makeFakeSettings();
        await expect(
            importEncryptedKeyVault(dst.settings, "u2", "garbage-not-a-vault", PASS),
        ).rejects.toBeInstanceOf(VaultDecryptError);
        expect(dst.state.keys).toEqual({});
    });

    it("the normal .alb backup still excludes the api_key_* fields (separation)", () => {
        expect(EXCLUDED_USER_SETTINGS_FIELDS.has("api_key_anthropic")).toBe(true);
        expect(EXCLUDED_USER_SETTINGS_FIELDS.has("api_key_openai")).toBe(true);
        expect(EXCLUDED_USER_SETTINGS_FIELDS.has("api_key_gemini")).toBe(true);
    });
});
