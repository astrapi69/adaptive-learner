/**
 * ai-key-store-adapter — the adaptive-learner implementation of
 * ``@astrapi69/ai-key-vault``'s ``AiKeyStoreAdapter``, mapping the generic
 * ``AiSettingsSnapshot`` onto this app's ``UserSettings`` shape and the
 * ``getStorage().settings`` namespace.
 *
 * Works in BOTH storage modes (``getStorage()`` returns the API or Dexie
 * implementation): the only mode-dependent bit is ``clientReadableKeys``,
 * which is true only in Dexie mode (in API mode the keys are Fernet-encrypted
 * server-side and ``exportApiKeys`` returns ``{}``, so the encrypted export is
 * disabled — the package's ``KeyVaultSection`` shows a notice instead).
 *
 * Field mapping:
 *   - snake_case ``has_<p>_key`` / ``key_source_<p>`` / ``key_preview_<p>`` /
 *     ``model_override_<p>`` / ``active_provider`` ⇄ the generic snapshot
 *   - key source ``"secrets_yaml"`` ⇄ the package's ``"secrets_file"``
 *   - backup ``tested_at`` ⇄ the package's ``testedAt``
 */

import type {
    AiKeyStoreAdapter,
    AiSettingsSnapshot,
    KeySource,
} from "@astrapi69/ai-key-vault";

import { AI_PROVIDERS, type AIProvider } from "../constants";
import { getStorage, resolveStorageMode } from "../../storage";
import type { ApiKeySource, UserSettings } from "../../types/domain";
import type { SettingsPatchBody } from "../../api/request-types";

function mapSource(source: ApiKeySource): KeySource {
    return source === "secrets_yaml" ? "secrets_file" : source;
}

function record<T>(fn: (provider: AIProvider) => T): Record<AIProvider, T> {
    return {
        anthropic: fn("anthropic"),
        openai: fn("openai"),
        gemini: fn("gemini"),
        perplexity: fn("perplexity"),
    };
}

/** Map this app's ``UserSettings`` onto the generic snapshot. */
function toSnapshot(s: UserSettings): AiSettingsSnapshot<AIProvider> {
    return {
        activeProvider: s.active_provider,
        hasKey: record((p) => s[`has_${p}_key`] as boolean),
        keySource: record((p) => mapSource(s[`key_source_${p}`])),
        keyPreview: record((p) => (s[`key_preview_${p}`] as string | null | undefined) ?? null),
        modelOverride: record((p) => (s[`model_override_${p}`] as string | null) ?? null),
    };
}

/**
 * Build the adaptive-learner AI key-store adapter over the active storage
 * namespace. Stateless — every method resolves ``getStorage()`` at call time
 * so it survives a storage-mode switch.
 */
export function createSettingsKeyStoreAdapter(): AiKeyStoreAdapter<AIProvider> {
    const settings = () => getStorage().settings;
    return {
        capabilities: {
            clientReadableKeys: resolveStorageMode() === "dexie",
            keyBackup: true,
            liveTest: true,
        },
        getSettings: async (userId) => toSnapshot(await settings().get(userId)),
        patchSettings: async (userId, patch) => {
            const body: SettingsPatchBody = {};
            if ("activeProvider" in patch && patch.activeProvider) {
                body.active_provider = patch.activeProvider;
            }
            if (patch.modelOverride) {
                for (const provider of AI_PROVIDERS) {
                    if (provider in patch.modelOverride) {
                        // A ``null`` override means "clear" — this app clears
                        // with an empty string.
                        body[`model_override_${provider}`] =
                            patch.modelOverride[provider] ?? "";
                    }
                }
            }
            return toSnapshot(await settings().update(userId, body));
        },
        setApiKey: async (userId, provider, key) =>
            toSnapshot(await settings().setApiKey(userId, { provider, key })),
        deleteApiKey: async (userId, provider) =>
            toSnapshot(await settings().deleteApiKey(userId, provider)),
        exportApiKeys: async (userId) => settings().exportApiKeys(userId),
        testApiKey: async (userId, provider, draftKey) =>
            settings().testApiKey(userId, { provider, key: draftKey }),
        backupApiKey: async (userId, provider, key) => {
            await settings().backupApiKey(userId, { provider, key });
        },
        getApiKeyBackup: async (userId, provider) => {
            const info = await settings().getApiKeyBackup(userId, provider);
            return { has: info.has, testedAt: info.tested_at };
        },
        restoreApiKeyBackup: async (userId, provider) =>
            toSnapshot(await settings().restoreApiKeyBackup(userId, provider)),
    };
}
