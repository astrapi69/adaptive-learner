/**
 * key-vault — the payload moved by the passphrase-encrypted key export
 * (EXP-038): the AI provider keys plus the provider settings. Pure shaping +
 * collect/apply helpers; the encryption lives in
 * ``lib/crypto/passphrase-vault`` and the storage reads/writes in the caller.
 */

import { AI_PROVIDERS, type AIProvider } from "../constants";
import type { UserSettings } from "../../types/domain";

/** Dedicated file extension for the encrypted key vault (NOT ``.alb``). */
export const KEY_VAULT_EXTENSION = ".alk";

/** The provider settings carried alongside the keys. */
export interface KeyVaultProviderSettings {
    active_provider: AIProvider | null;
    model_override_anthropic: string | null;
    model_override_openai: string | null;
    model_override_gemini: string | null;
}

/** Decrypted vault payload. Only providers that have a key are present in
 *  ``keys``; ``providerSettings`` always carries the four fields. */
export interface KeyVaultPayload {
    keys: Partial<Record<AIProvider, string>>;
    providerSettings: KeyVaultProviderSettings;
}

/** Raw plaintext keys as read from storage (Dexie row fields). */
export type RawApiKeys = Partial<Record<AIProvider, string>>;

/** Drop empty / whitespace-only keys so the vault only carries usable ones. */
export function presentKeys(raw: RawApiKeys): RawApiKeys {
    const out: RawApiKeys = {};
    for (const provider of AI_PROVIDERS) {
        const key = raw[provider];
        if (typeof key === "string" && key.trim().length > 0) {
            out[provider] = key;
        }
    }
    return out;
}

/** True when at least one provider has an exportable key. Drives the
 *  export-entry gate (FUNKTION-NICHT-VERFUEGBAR when false). */
export function hasExportableKey(raw: RawApiKeys): boolean {
    return Object.keys(presentKeys(raw)).length > 0;
}

/** Build the vault payload from the raw keys + the user's settings. */
export function buildKeyVaultPayload(
    raw: RawApiKeys,
    settings: Pick<
        UserSettings,
        | "active_provider"
        | "model_override_anthropic"
        | "model_override_openai"
        | "model_override_gemini"
    >,
): KeyVaultPayload {
    return {
        keys: presentKeys(raw),
        providerSettings: {
            active_provider: settings.active_provider ?? null,
            model_override_anthropic: settings.model_override_anthropic ?? null,
            model_override_openai: settings.model_override_openai ?? null,
            model_override_gemini: settings.model_override_gemini ?? null,
        },
    };
}

/** Structural check that a decrypted object is a usable vault payload. A valid
 *  envelope can still decrypt to the wrong shape (e.g. a different app's file);
 *  reject it the same friendly way as a bad passphrase. */
export function isKeyVaultPayload(value: unknown): value is KeyVaultPayload {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    if (!v.keys || typeof v.keys !== "object") return false;
    if (!v.providerSettings || typeof v.providerSettings !== "object") {
        return false;
    }
    const keys = v.keys as Record<string, unknown>;
    for (const [provider, key] of Object.entries(keys)) {
        if (!AI_PROVIDERS.includes(provider as AIProvider)) return false;
        if (typeof key !== "string") return false;
    }
    return true;
}
