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

import { useEffect, useState } from "react";

import { Feature } from "@astrapi69/feature-strategy-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "../../../api/client";
import { FEATURES } from "../../../features/featureConfig";
import { useI18n } from "../../../hooks/ui/useI18n";
import { getStorage } from "../../../storage";
import { notify } from "../../../utils/notify";

const DEFAULT_REPOS_DIR = "~/.local/share/adaptive_learner/repos";

interface LearningRepoSettings {
  enable_git: boolean;
  repos_dir: string;
}

export default function LearningRepoSettingsSection() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<LearningRepoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Phase 49G: pluginSettings round-trip works in both
    // modes via getStorage().pluginSettings (49A). The
    // ApiStorage call hits /api/plugin-settings; the
    // DexieStorage call reads the IndexedDB row or
    // falls back to the bundled YAML defaults at
    // frontend/src/data/plugin-config/learning-repo.json.
    let cancelled = false;
    getStorage()
      .pluginSettings.get("learning-repo")
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
        const message = err instanceof ApiError ? err.detail : String(err);
        notify.error(t("repo.settings.error.load", "Could not load settings") + ": " + message);
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
      await getStorage().pluginSettings.update("learning-repo", {
        settings: {
          enable_git: settings.enable_git,
          repos_dir: settings.repos_dir || DEFAULT_REPOS_DIR,
        },
      });
      notify.success(t("repo.settings.toast.saved", "Settings saved"));
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : String(err);
      notify.error(t("repo.settings.error.save", "Could not save settings") + ": " + message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || settings === null) {
    return (
      <section
        className="settings-section"
        data-testid="learning-repo-settings-loading"
      >
        <p>{t("repo.settings.loading", "Loading…")}</p>
      </section>
    );
  }

  return (
    <section className="settings-section" data-testid="learning-repo-settings">
      <h2 className="settings-section-title">
        {t("repo.settings.title", "Learning Repository")}
      </h2>
      <p className="m-0 text-sm text-[var(--fg-muted)]">
        {t(
          "repo.settings.description",
          "Auto-emits Markdown artefacts (README, STATS, CHEATSHEET, ROADMAP) per project from your session data. Optional git integration commits each render so you can browse the history with any git client.",
        )}
      </p>

      {/* Git persistence needs a server-side filesystem + git binary,
          so the toggle is disabled in Dexie mode with an explanation
          naming the desktop app (#335) instead of hidden. */}
      <Feature
        id={FEATURES.LEARNING_REPO_GIT}
        whenDisabled={
          <div className="flex flex-col gap-1" data-testid="learning-repo-git-desktop-only">
            <label className="flex items-center gap-2 text-fg-muted">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={false}
                disabled
                readOnly
                data-testid="learning-repo-settings-enable-git"
              />
              <span>{t("repo.settings.enable_git", "Enable git persistence")}</span>
            </label>
            <p className="m-0 text-sm text-fg-muted">
              {t("feature.desktop_only", "Only available with the desktop app.")}
            </p>
          </div>
        }
      >
        <label className="flex items-center gap-2 text-[var(--fg-primary)]">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-[var(--accent)]"
            checked={settings.enable_git}
            onChange={(e) => setSettings({ ...settings, enable_git: e.target.checked })}
            data-testid="learning-repo-settings-enable-git"
          />
          <span>{t("repo.settings.enable_git", "Enable git persistence")}</span>
        </label>
      </Feature>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-[var(--fg-primary)]">
          {t("repo.settings.repos_dir", "Repositories directory")}
        </span>
        <Input
          type="text"
          value={settings.repos_dir}
          placeholder={DEFAULT_REPOS_DIR}
          onChange={(e) => setSettings({ ...settings, repos_dir: e.target.value })}
          data-testid="learning-repo-settings-repos-dir"
        />
      </label>

      <div className="mt-2">
        <Button
          type="button"
          variant="default"
          onClick={handleSave}
          disabled={saving}
          data-testid="learning-repo-settings-save"
        >
          {saving ? t("repo.settings.saving", "Saving…") : t("repo.settings.save", "Save settings")}
        </Button>
      </div>
    </section>
  );
}
