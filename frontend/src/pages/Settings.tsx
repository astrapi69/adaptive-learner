import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

import {api, ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {AI_PROVIDERS, SUPPORTED_LANGUAGES, type AIProvider} from "../lib/constants";
import {readLearnerState, setLanguage} from "../lib/learnerState";
import {notify} from "../utils/notify";
import type {UserSettings} from "../types";

/**
 * Settings page (project-reference §8 row ``/settings``).
 *
 * Three sections:
 *
 *   1. Language: writes through PATCH /api/settings/{user_id}
 *      (updates both User.language and UserSettings.language in
 *      one transaction) and to the live i18n provider.
 *   2. AI provider: PATCH the active_provider on
 *      UserSettings. Live-switch.
 *   3. API keys: per-provider Save / Delete via the dedicated
 *      encrypted endpoints. The page never sees the actual key
 *      ciphertext — UserSettingsOut only exposes boolean
 *      ``has_<provider>_key`` flags.
 *
 * Pre-condition: user_id in localStorage; missing redirects to
 * /onboarding.
 */
export default function Settings() {
    const {t, lang, setLang} = useI18n();
    const navigate = useNavigate();

    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [keyDrafts, setKeyDrafts] = useState<Record<AIProvider, string>>({
        anthropic: "",
        openai: "",
        gemini: "",
    });
    const [busy, setBusy] = useState<string | null>(null);

    useEffect(() => {
        const userId = readLearnerState().userId;
        if (!userId) {
            navigate("/onboarding", {replace: true});
            return;
        }
        let cancelled = false;
        api.settings
            .get(userId)
            .then((s) => {
                if (cancelled) return;
                setSettings(s);
            })
            .catch((err) => {
                if (cancelled) return;
                const detail =
                    err instanceof ApiError ? err.detail : t("common.error");
                setLoadError(detail);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    const handleLangChange = async (newLang: string) => {
        if (!settings || busy) return;
        setBusy("lang");
        try {
            const updated = await api.settings.update(settings.user_id, {
                language: newLang,
            });
            setSettings(updated);
            setLang(newLang);
            setLanguage(newLang);
            notify.success(t("settings.saved", "Saved."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    const handleProviderChange = async (provider: AIProvider) => {
        if (!settings || busy) return;
        setBusy("provider");
        try {
            const updated = await api.settings.update(settings.user_id, {
                active_provider: provider,
            });
            setSettings(updated);
            notify.success(t("settings.saved", "Saved."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    const handleSaveKey = async (provider: AIProvider) => {
        if (!settings || busy) return;
        const key = keyDrafts[provider].trim();
        if (key.length === 0) return;
        setBusy(`save-${provider}`);
        try {
            const updated = await api.settings.setApiKey(settings.user_id, {
                provider,
                key,
            });
            setSettings(updated);
            setKeyDrafts((prev) => ({...prev, [provider]: ""}));
            notify.success(t("toast.api_key_saved", "API key saved."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    const handleDeleteKey = async (provider: AIProvider) => {
        if (!settings || busy) return;
        const ok = window.confirm(
            t("settings.api_key_confirm_delete", "Really remove this API key?"),
        );
        if (!ok) return;
        setBusy(`delete-${provider}`);
        try {
            const updated = await api.settings.deleteApiKey(settings.user_id, provider);
            setSettings(updated);
            notify.success(t("toast.api_key_deleted", "API key removed."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setBusy(null);
        }
    };

    if (loadError) {
        return (
            <main data-testid="settings-error" className="settings-page">
                <p className="error-text">{loadError}</p>
            </main>
        );
    }
    if (!settings) {
        return (
            <main data-testid="settings-loading" className="settings-page">
                <p className="muted">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    return (
        <main data-testid="settings" className="settings-page">
            <header>
                <h1>{t("settings.title", "Settings")}</h1>
            </header>

            <section className="settings-section">
                <h2 className="settings-section-title">
                    {t("settings.section_language", "Language")}
                </h2>
                <label className="form-row">
                    <span className="form-label">
                        {t("settings.language_label", "Display language")}
                    </span>
                    <select
                        data-testid="settings-language"
                        value={lang}
                        disabled={busy === "lang"}
                        onChange={(e) => handleLangChange(e.target.value)}
                    >
                        {SUPPORTED_LANGUAGES.map((code) => (
                            <option key={code} value={code}>
                                {code.toUpperCase()}
                            </option>
                        ))}
                    </select>
                </label>
            </section>

            <section className="settings-section">
                <h2 className="settings-section-title">
                    {t("settings.section_provider", "AI provider")}
                </h2>
                <label className="form-row">
                    <span className="form-label">
                        {t("settings.provider_label", "Active provider")}
                    </span>
                    <select
                        data-testid="settings-provider"
                        value={settings.active_provider}
                        disabled={busy === "provider"}
                        onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                    >
                        {AI_PROVIDERS.map((p) => (
                            <option key={p} value={p}>
                                {t(`settings.provider_${p}`, p)}
                            </option>
                        ))}
                    </select>
                </label>
            </section>

            <section className="settings-section">
                <h2 className="settings-section-title">
                    {t("settings.section_api_keys", "API keys")}
                </h2>
                {AI_PROVIDERS.map((provider) => {
                    const has = settings[`has_${provider}_key`] as boolean;
                    return (
                        <div
                            key={provider}
                            className="api-key-row"
                            data-testid={`api-key-row-${provider}`}
                        >
                            <div className="api-key-row-head">
                                <strong>{t(`settings.provider_${provider}`, provider)}</strong>
                                <span
                                    className={`api-key-status ${has ? "is-set" : "is-missing"}`}
                                    data-testid={`api-key-status-${provider}`}
                                >
                                    {has
                                        ? t("settings.api_key_saved", "Key stored")
                                        : t("settings.api_key_missing", "Not set")}
                                </span>
                            </div>
                            <div className="api-key-row-input">
                                <input
                                    data-testid={`api-key-input-${provider}`}
                                    type="password"
                                    placeholder={t("settings.api_key_placeholder", "Paste here…")}
                                    autoComplete="off"
                                    value={keyDrafts[provider]}
                                    onChange={(e) =>
                                        setKeyDrafts((prev) => ({
                                            ...prev,
                                            [provider]: e.target.value,
                                        }))
                                    }
                                    disabled={busy === `save-${provider}`}
                                />
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    data-testid={`api-key-save-${provider}`}
                                    onClick={() => handleSaveKey(provider)}
                                    disabled={
                                        busy === `save-${provider}` ||
                                        keyDrafts[provider].trim().length === 0
                                    }
                                >
                                    {t("settings.api_key_set", "Save key")}
                                </button>
                                {has && (
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        data-testid={`api-key-delete-${provider}`}
                                        onClick={() => handleDeleteKey(provider)}
                                        disabled={busy === `delete-${provider}`}
                                    >
                                        {t("settings.api_key_delete", "Remove key")}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </section>
        </main>
    );
}
