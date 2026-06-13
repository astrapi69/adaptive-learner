/**
 * State + handlers for the Settings AI tab (provider, model overrides,
 * API keys).
 *
 * Lifted out of the Settings page so the three AI sections share one
 * source of truth for the in-flight drafts, the per-provider busy
 * marker, the live-test results, and the key-rollback panel state. The
 * page owns the canonical ``settings`` object; this hook reads it and
 * writes back through ``onSettingsChange``.
 *
 * The page never sees raw key ciphertext — keys are saved/tested/deleted
 * through the dedicated encrypted storage endpoints, and ``settings``
 * only carries boolean ``has_<provider>_key`` flags.
 */

import {useState} from "react";

import {ApiError} from "../api/client";
import {useI18n} from "./useI18n";
import {refreshApiKeyStatus} from "./useApiKeyStatus";
import type {AIProvider} from "../lib/constants";
import {getStorage} from "../storage";
import type {ApiKeyTestResult} from "../storage/types";
import {notify} from "../utils/notify";
import type {UserSettings} from "../types";

/**
 * AI-tab state + handlers. The page passes the loaded ``settings`` and a
 * setter; every handler writes the fresh settings back via
 * ``onSettingsChange``.
 *
 * @param settings - The loaded user settings (non-null on the AI tab).
 * @param onSettingsChange - Commit updated settings back to the page.
 */
export function useAiKeySettings(
    settings: UserSettings,
    onSettingsChange: (next: UserSettings) => void,
) {
    const {t} = useI18n();

    const [keyDrafts, setKeyDrafts] = useState<Record<AIProvider, string>>({
        anthropic: "",
        openai: "",
        gemini: "",
    });
    // v0.4.0 — local drafts for the model-override inputs. The
    // committed value lives on ``settings.model_override_<provider>``;
    // the draft is the user's in-flight edit before they hit Save.
    const [modelDrafts, setModelDrafts] = useState<Record<AIProvider, string>>(() => ({
        anthropic: settings.model_override_anthropic ?? "",
        openai: settings.model_override_openai ?? "",
        gemini: settings.model_override_gemini ?? "",
    }));
    const [busy, setBusy] = useState<string | null>(null);
    // C2 — last live-test outcome per provider (null = not tested this
    // session). Drives the inline result line under the key row.
    const [testResults, setTestResults] = useState<Record<AIProvider, ApiKeyTestResult | null>>({
        anthropic: null,
        openai: null,
        gemini: null,
    });
    // C4 — when an auto-test on save fails, this holds the provider +
    // failure kind so the inline rollback panel (keep old / save anyway
    // / cancel) renders for that provider.
    const [rollbackPrompt, setRollbackPrompt] = useState<{
        provider: AIProvider;
        kind: ApiKeyTestResult["kind"];
    } | null>(null);
    // C4 — whether a last-known-good backup exists per provider (drives
    // the "restore last working key" affordance). Loaded after settings.
    const [backupAvailable, setBackupAvailable] = useState<Record<AIProvider, boolean>>({
        anthropic: false,
        openai: false,
        gemini: false,
    });

    const handleProviderChange = async (provider: AIProvider) => {
        if (busy) return;
        setBusy("provider");
        try {
            const updated = await getStorage().settings.update(settings.user_id, {
                active_provider: provider,
            });
            onSettingsChange(updated);
            await refreshApiKeyStatus();
            notify.success(t("settings.saved", "Saved."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    // C4 — persist a key (no test). Backs up the key as last-known-good
    // only when ``backup`` is true (i.e. it passed its test).
    const persistKey = async (provider: AIProvider, key: string, backup: boolean) => {
        const updated = await getStorage().settings.setApiKey(settings.user_id, {
            provider,
            key,
        });
        if (backup) {
            await getStorage().settings.backupApiKey(settings.user_id, {
                provider,
                key,
            });
            setBackupAvailable((prev) => ({ ...prev, [provider]: true }));
        }
        onSettingsChange(updated);
        setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
        await refreshApiKeyStatus();
        notify.success(t("toast.api_key_saved", "API key saved."));
    };

    // C4 — revised save flow: auto-test the new key BEFORE overwriting.
    // Passes -> save + back up. Fails -> rollback panel (the old key is
    // untouched because we tested without saving).
    const handleSaveKey = async (provider: AIProvider) => {
        if (busy) return;
        const key = keyDrafts[provider].trim();
        if (key.length === 0) return;
        setBusy(`save-${provider}`);
        setRollbackPrompt(null);
        try {
            const test = await getStorage().settings.testApiKey(settings.user_id, {
                provider,
                key,
            });
            setTestResults((prev) => ({ ...prev, [provider]: test }));
            if (test.success) {
                await persistKey(provider, key, true);
            } else {
                // Surface keep-old / save-anyway / cancel. If a backup
                // exists, the panel also offers restore.
                const info = await getStorage()
                    .settings.getApiKeyBackup(settings.user_id, provider)
                    .catch(() => ({ has: false, tested_at: null }));
                setBackupAvailable((prev) => ({ ...prev, [provider]: info.has }));
                setRollbackPrompt({ provider, kind: test.kind });
            }
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    const handleSaveAnyway = async (provider: AIProvider) => {
        if (busy) return;
        const key = keyDrafts[provider].trim();
        if (key.length === 0) return;
        setBusy(`save-${provider}`);
        try {
            // No backup — the key failed its test, so it must not become
            // the last-known-good.
            await persistKey(provider, key, false);
            setRollbackPrompt(null);
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    // Discard the draft, keep the currently-active key.
    const handleKeepOldKey = (provider: AIProvider) => {
        setRollbackPrompt(null);
        setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
    };

    // Dismiss the panel but keep the draft so the user can fix a typo.
    const handleDismissRollback = () => setRollbackPrompt(null);

    const handleRestoreBackup = async (provider: AIProvider) => {
        if (busy) return;
        setBusy(`restore-${provider}`);
        setRollbackPrompt(null);
        try {
            const updated = await getStorage().settings.restoreApiKeyBackup(settings.user_id, provider);
            onSettingsChange(updated);
            setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
            await refreshApiKeyStatus();
            // Confirm the restored key still works.
            const test = await getStorage().settings.testApiKey(settings.user_id, {
                provider,
            });
            setTestResults((prev) => ({ ...prev, [provider]: test }));
            notify.success(t("toast.api_key_restored", "Last working key restored."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    // C2 — live-test a key. Tests the in-progress draft when present,
    // otherwise the currently-stored key. Does not save.
    const handleTestKey = async (provider: AIProvider) => {
        if (busy) return;
        const draft = keyDrafts[provider].trim();
        setBusy(`test-${provider}`);
        setTestResults((prev) => ({ ...prev, [provider]: null }));
        try {
            const result = await getStorage().settings.testApiKey(settings.user_id, {
                provider,
                key: draft.length > 0 ? draft : undefined,
            });
            setTestResults((prev) => ({ ...prev, [provider]: result }));
        } catch {
            // A thrown call (rather than a classified result) is itself a
            // connectivity problem — surface it as the network outcome.
            setTestResults((prev) => ({
                ...prev,
                [provider]: { success: false, kind: "network" },
            }));
        } finally {
            setBusy(null);
        }
    };

    const handleSaveModel = async (provider: AIProvider) => {
        if (busy) return;
        const draft = modelDrafts[provider].trim();
        const current = settings[`model_override_${provider}`] ?? "";
        if (draft === current) return;
        setBusy(`save-model-${provider}`);
        try {
            const updated = await getStorage().settings.update(settings.user_id, {
                [`model_override_${provider}`]: draft,
            });
            onSettingsChange(updated);
            // Snap the draft back to the canonical persisted value.
            const fresh = updated[`model_override_${provider}`] ?? "";
            setModelDrafts((prev) => ({ ...prev, [provider]: fresh }));
            notify.success(t("settings.saved", "Saved."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    const handleClearModel = async (provider: AIProvider) => {
        if (busy) return;
        setBusy(`clear-model-${provider}`);
        try {
            const updated = await getStorage().settings.update(settings.user_id, {
                [`model_override_${provider}`]: "",
            });
            onSettingsChange(updated);
            setModelDrafts((prev) => ({ ...prev, [provider]: "" }));
            notify.success(t("settings.saved", "Saved."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    const handleDeleteKey = async (provider: AIProvider) => {
        if (busy) return;
        const ok = window.confirm(t("settings.api_key_confirm_delete", "Really remove this API key?"));
        if (!ok) return;
        setBusy(`delete-${provider}`);
        try {
            const updated = await getStorage().settings.deleteApiKey(settings.user_id, provider);
            onSettingsChange(updated);
            await refreshApiKeyStatus();
            notify.success(t("toast.api_key_deleted", "API key removed."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    return {
        busy,
        keyDrafts,
        setKeyDrafts,
        modelDrafts,
        setModelDrafts,
        testResults,
        rollbackPrompt,
        backupAvailable,
        handleProviderChange,
        handleSaveKey,
        handleSaveAnyway,
        handleKeepOldKey,
        handleDismissRollback,
        handleRestoreBackup,
        handleTestKey,
        handleSaveModel,
        handleClearModel,
        handleDeleteKey,
    };
}

/** Return shape of {@link useAiKeySettings}. */
export type UseAiKeySettingsResult = ReturnType<typeof useAiKeySettings>;
