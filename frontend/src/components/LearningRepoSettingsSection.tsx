/**
 * Settings > Plugins > Learning Repository
 * (v1.26.0 / Phase 42 / BL-30 commit 6).
 *
 * Three controls:
 *   - ``enable_git`` toggle (off by default; opt-in for on-disk
 *     persistence with git commits + tags).
 *   - ``repos_dir`` text input with the platform default as
 *     placeholder.
 *   - "Save settings" button — POSTs to the new
 *     ``/api/plugins/settings/learning-repo`` endpoint (lands in
 *     this commit). The plugin re-reads its config on the next
 *     persist call.
 *
 * Why a dedicated section vs. piggybacking on About: per the
 * architecture rule, every non-``# INTERNAL`` plugin setting must
 * be editable in the plugin UI. ``enable_git`` and ``repos_dir``
 * are durable user-visible settings — they deserve their own
 * panel with a save button + a success toast.
 */

import {useEffect, useState} from "react";

import {api, ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {notify} from "../utils/notify";

const DEFAULT_REPOS_DIR = "~/.local/share/adaptive_learner/repos";

interface LearningRepoSettings {
    enable_git: boolean;
    repos_dir: string;
}

export default function LearningRepoSettingsSection() {
    const {t} = useI18n();
    const [settings, setSettings] = useState<LearningRepoSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.pluginSettings
            .get("learning-repo")
            .then((data) => {
                if (cancelled) return;
                setSettings({
                    enable_git: Boolean(data.settings?.enable_git ?? false),
                    repos_dir:
                        typeof data.settings?.repos_dir === "string"
                            ? data.settings.repos_dir
                            : DEFAULT_REPOS_DIR,
                });
            })
            .catch((err) => {
                if (cancelled) return;
                const message =
                    err instanceof ApiError ? err.detail : String(err);
                notify.error(
                    t("repo.settings.error.load", "Could not load settings") +
                        ": " +
                        message,
                );
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [t]);

    const handleSave = async () => {
        if (settings === null) return;
        setSaving(true);
        try {
            await api.pluginSettings.update("learning-repo", {
                settings: {
                    enable_git: settings.enable_git,
                    repos_dir: settings.repos_dir || DEFAULT_REPOS_DIR,
                },
            });
            notify.success(t("repo.settings.toast.saved", "Settings saved"));
        } catch (err) {
            const message =
                err instanceof ApiError ? err.detail : String(err);
            notify.error(
                t("repo.settings.error.save", "Could not save settings") +
                    ": " +
                    message,
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading || settings === null) {
        return (
            <section data-testid="learning-repo-settings-loading">
                <p>{t("repo.settings.loading", "Loading…")}</p>
            </section>
        );
    }

    return (
        <section
            className="learning-repo-settings-section"
            data-testid="learning-repo-settings"
        >
            <h2>{t("repo.settings.title", "Learning Repository")}</h2>
            <p className="settings-section-description">
                {t(
                    "repo.settings.description",
                    "Auto-emits Markdown artefacts (README, STATS, CHEATSHEET, ROADMAP) per project from your session data. Optional git integration commits each render so you can browse the history with any git client.",
                )}
            </p>

            <label className="settings-row">
                <input
                    type="checkbox"
                    checked={settings.enable_git}
                    onChange={(e) =>
                        setSettings({...settings, enable_git: e.target.checked})
                    }
                    data-testid="learning-repo-settings-enable-git"
                />
                <span>
                    {t(
                        "repo.settings.enable_git",
                        "Enable git persistence (POST /persist endpoint)",
                    )}
                </span>
            </label>

            <label className="settings-row settings-row-stacked">
                <span>{t("repo.settings.repos_dir", "Repositories directory")}</span>
                <input
                    type="text"
                    value={settings.repos_dir}
                    placeholder={DEFAULT_REPOS_DIR}
                    onChange={(e) =>
                        setSettings({...settings, repos_dir: e.target.value})
                    }
                    data-testid="learning-repo-settings-repos-dir"
                />
            </label>

            <div className="settings-row">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    data-testid="learning-repo-settings-save"
                >
                    {saving
                        ? t("repo.settings.saving", "Saving…")
                        : t("repo.settings.save", "Save settings")}
                </button>
            </div>
        </section>
    );
}
