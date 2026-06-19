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

import {ApiError} from "../../api/client";
import {useI18n} from "../ui/useI18n";
import {useConfirm} from "../../contexts/ConfirmContext";
import {refreshApiKeyStatus} from "./useApiKeyStatus";
import type {AIProvider} from "../../lib/constants";
import {getStorage} from "../../storage";
import type {ApiKeyTestResult} from "../../storage/types";
import {notify} from "../../utils/notify";
import type {UserSettings} from "../../types";

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
    const confirm = useConfirm();

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
    // #793 — whether a last-known-good backup exists per provider (drives
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

    // Persist a key (no test). Backing the key up as last-known-good is
    // the caller's responsibility (#793 — only after an advisory test
    // passes), so this just stores the key and refreshes the UI.
    const persistKey = async (provider: AIProvider, key: string) => {
        const updated = await getStorage().settings.setApiKey(settings.user_id, {
            provider,
            key,
        });
        onSettingsChange(updated);
        setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
        await refreshApiKeyStatus();
        notify.success(t("toast.api_key_saved", "API key saved."));
    };

    // #793 — save flow: a shape-valid key MUST always be saveable. The
    // live test is advisory only and must never block the save (a flaky
    // or false-negative provider test previously diverted a valid key to
    // the rollback panel and never persisted it). So: persist first, then
    // test. Test passes -> back the key up as last-known-good. Test fails
    // -> the key stays saved; surface the result + a non-blocking "restore
    // last working key" link (no blocking rollback panel).
    const handleSaveKey = async (provider: AIProvider) => {
        if (busy) return;
        const key = keyDrafts[provider].trim();
        if (key.length === 0) return;
        setBusy(`save-${provider}`);
        try {
            await persistKey(provider, key);
            let test: ApiKeyTestResult;
            try {
                test = await getStorage().settings.testApiKey(settings.user_id, {
                    provider,
                    key,
                });
            } catch {
                // A thrown call (not a classified result) is a connectivity
                // problem — advisory only, the key is already saved.
                test = { success: false, kind: "network" };
            }
            setTestResults((prev) => ({ ...prev, [provider]: test }));
            if (test.success) {
                await getStorage().settings.backupApiKey(settings.user_id, {
                    provider,
                    key,
                });
                setBackupAvailable((prev) => ({ ...prev, [provider]: true }));
            } else {
                // Offer the standalone restore link only when a backup exists.
                const info = await getStorage()
                    .settings.getApiKeyBackup(settings.user_id, provider)
                    .catch(() => ({ has: false, tested_at: null }));
                setBackupAvailable((prev) => ({ ...prev, [provider]: info.has }));
            }
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    const handleRestoreBackup = async (provider: AIProvider) => {
        if (busy) return;
        setBusy(`restore-${provider}`);
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
        const ok = await confirm({
            message: t("settings.api_key_confirm_delete", "Really remove this API key?"),
            confirmLabel: t("common.remove", "Remove"),
            variant: "danger",
        });
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
        backupAvailable,
        handleProviderChange,
        handleSaveKey,
        handleRestoreBackup,
        handleTestKey,
        handleSaveModel,
        handleClearModel,
        handleDeleteKey,
    };
}

/** Return shape of {@link useAiKeySettings}. */
export type UseAiKeySettingsResult = ReturnType<typeof useAiKeySettings>;
