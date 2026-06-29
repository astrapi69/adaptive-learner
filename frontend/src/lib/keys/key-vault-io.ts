/**
 * key-vault-io — orchestrates the passphrase-encrypted key export/import
 * (EXP-038): read keys + provider settings from storage, encrypt to a `.alk`
 * envelope, and on import decrypt and write back through the SAME storage sinks
 * manual key entry uses (``setApiKey`` + ``update``).
 *
 * The settings namespace is injected (not imported) so this stays pure and
 * unit-testable with an in-memory fake. ``VaultDecryptError`` propagates for a
 * wrong passphrase / corrupt file; nothing is written until the payload has
 * fully decrypted AND validated as a key vault, so a failed decrypt never
 * produces a partial import.
 */

import { decryptFromVault, encryptToVault, VaultDecryptError } from "../crypto/passphrase-vault";
import {
    buildKeyVaultPayload,
    hasExportableKey,
    isKeyVaultPayload,
    presentKeys,
    type KeyVaultPayload,
} from "./key-vault";
import { AI_PROVIDERS, type AIProvider } from "../constants";
import type { ISettingsNamespace } from "../../storage/types";

/**
 * Build the encrypted `.alk` envelope for the user's keys + provider settings,
 * or ``null`` when there is no exportable key (export entry should be
 * disabled — FUNKTION-NICHT-VERFUEGBAR).
 */
export async function buildEncryptedKeyVault(
    settings: ISettingsNamespace,
    userId: string,
    passphrase: string,
): Promise<string | null> {
    const raw = await settings.exportApiKeys(userId);
    if (!hasExportableKey(raw)) return null;
    const userSettings = await settings.get(userId);
    const payload = buildKeyVaultPayload(raw, userSettings);
    return encryptToVault(payload, passphrase);
}

/** Result of a successful import: which providers got a key. */
export interface KeyVaultImportResult {
    providers: AIProvider[];
}

/**
 * Decrypt a `.alk` file and write its keys + provider settings into storage.
 * Throws {@link VaultDecryptError} for a wrong passphrase / corrupt / foreign
 * file BEFORE any write (no partial import).
 */
export async function importEncryptedKeyVault(
    settings: ISettingsNamespace,
    userId: string,
    fileText: string,
    passphrase: string,
): Promise<KeyVaultImportResult> {
    const decrypted = await decryptFromVault<unknown>(fileText, passphrase);
    if (!isKeyVaultPayload(decrypted)) {
        // A valid envelope that decrypted to the wrong shape (e.g. a foreign
        // file) — reject the same friendly way, never a partial write.
        throw new VaultDecryptError();
    }
    const payload: KeyVaultPayload = {
        keys: presentKeys(decrypted.keys),
        providerSettings: decrypted.providerSettings,
    };

    const written: AIProvider[] = [];
    for (const provider of AI_PROVIDERS) {
        const key = payload.keys[provider];
        if (key) {
            await settings.setApiKey(userId, { provider, key });
            written.push(provider);
        }
    }
    await settings.update(userId, {
        ...(payload.providerSettings.active_provider
            ? { active_provider: payload.providerSettings.active_provider }
            : {}),
        model_override_anthropic:
            payload.providerSettings.model_override_anthropic ?? "",
        model_override_openai:
            payload.providerSettings.model_override_openai ?? "",
        model_override_gemini:
            payload.providerSettings.model_override_gemini ?? "",
    });
    return { providers: written };
}
