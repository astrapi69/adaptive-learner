import { useEffect, useState } from "react";

import { ApiError } from "../../../../api/client";
import ContentViewControl from "../../../../components/settings/controls/lesson/ContentViewControl";
import ContentTabsOrderControl from "../../../../components/settings/controls/content/ContentTabsOrderControl";
import InstallAppSection from "../../../../components/settings/data/InstallAppSection";
import ModeIndicator from "../../../../components/pwa/ModeIndicator";
import UpdatesSettingsSection from "../../../../components/settings/UpdatesSettingsSection";
import ThemePicker from "../../../../components/settings/appearance/ThemePicker";
import AvatarUpload from "../../../../shared/media/AvatarUpload";
import { setButtonTooltipsEnabled, useButtonTooltips } from "../../../../hooks/settings/useButtonTooltips";
import { setDevModeEnabled, useDevMode } from "../../../../hooks/settings/useDevMode";
import { useI18n } from "../../../../hooks/ui/useI18n";
import { buildLanguageOptions } from "../../../../lib/i18n/languages";
import LanguagePicker from "../../../../shared/forms/LanguagePicker";
import { readLearnerState, setLanguage } from "../../../../lib/learning/learnerState";
import { notifyProfileUpdated } from "../../../../lib/learning/profileSignal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getStorage,
  getStorageRowCounts,
  isDexieOnlyBuild,
  resolveStorageMode,
  setPersistedStorageMode,
  type StorageMode,
} from "../../../../storage";
import { notify } from "../../../../utils/notify";
import type { UserSettings } from "../../../../types";

interface GeneralPanelProps {
  /** The loaded user settings (the panel only renders once present). */
  settings: UserSettings;
  /** Commit updated settings back to the Settings page. */
  onSettingsChange: (next: UserSettings) => void;
  /** Whether the General tab is the active tab (drives ``hidden``). */
  active: boolean;
}

/**
 * General tab of the Settings page: profile (display name + avatar),
 * appearance (theme + content view), content-tab order, display language,
 * interface toggles (button tooltips, developer mode), storage mode,
 * desktop update preferences, and the mode indicator.
 *
 * Owns the general-tab state + handlers (name/avatar/language mutations,
 * interface toggles, storage-mode selection, row counts) so the Settings
 * page shell stays a thin tab-router (#1447). Extracted verbatim; every
 * section stays mounted (``hidden`` when the tab is inactive) so deep
 * links and ``data-testid`` assertions keep working.
 *
 * @example
 * <GeneralPanel
 *   settings={settings}
 *   onSettingsChange={setSettings}
 *   active={activeTab === "general"}
 * />
 */
export default function GeneralPanel({
  settings,
  onSettingsChange,
  active,
}: GeneralPanelProps) {
  const { t, lang, setLang } = useI18n();

  // #508 — the learner's display name for the initials-avatar fallback.
  const [userName, setUserName] = useState<string>("");
  // #579 — editable display-name draft + validation message.
  const [nameDraft, setNameDraft] = useState<string>("");
  const [nameError, setNameError] = useState<string | null>(null);

  // Phase 38 — button-tooltip preference. ``useButtonTooltips``
  // hook reads localStorage + listens for change events; this
  // local state mirrors it so the toggle reflects the current
  // value on first render.
  const buttonTooltipsOn = useButtonTooltips();
  const handleButtonTooltipsToggle = (next: boolean) => {
    setButtonTooltipsEnabled(next);
  };

  // DEV-MODE-FRIENDLY-ERRORS-01 — Developer Mode toggle.
  // When ON, error toasts show full technical detail and the
  // Navigation bar carries a DEV badge. Off by default —
  // production users only see friendly status-code-mapped
  // messages.
  const devModeOn = useDevMode();
  const handleDevModeToggle = (next: boolean) => {
    setDevModeEnabled(next);
  };

  // Per-operation busy marker for the language switch + profile edits.
  // The AI tab owns its own busy state inside ``useAiKeySettings``.
  const [busy, setBusy] = useState<string | null>(null);

  // Phase 10F: storage-mode toggle. ``currentMode`` reflects
  // what's active *right now* (snapshot at mount). Switching is
  // "persist + reload required" since live-swap would orphan
  // in-memory state.
  const [currentMode] = useState<StorageMode>(() => resolveStorageMode());
  const [rowCounts, setRowCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStorageRowCounts().then((counts) => {
      if (cancelled) return;
      setRowCounts(counts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // #508 — load the display name for the avatar initials fallback + the
  // editable name field. The Settings shell already redirects when the
  // user_id is missing, so a name failure here is non-fatal.
  useEffect(() => {
    const userId = readLearnerState().userId;
    if (!userId) return;
    let cancelled = false;
    void getStorage()
      .users.get(userId)
      .then((u) => {
        if (cancelled) return;
        setUserName(u.name);
        setNameDraft(u.name);
      })
      .catch(() => {
        /* name is only the avatar fallback — non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleStorageModeChange(next: StorageMode): void {
    if (next === currentMode) return;
    setPersistedStorageMode(next);
    notify.success(
      t(
        "settings.storage_mode_switch_notice",
        "Storage mode saved. Reload the page to switch to the new backend.",
      ),
    );
  }

  const handleLangChange = async (newLang: string) => {
    if (!settings || busy) return;
    setBusy("lang");
    try {
      const updated = await getStorage().settings.update(settings.user_id, {
        language: newLang,
      });
      onSettingsChange(updated);
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

  // #508 — set / clear the profile picture. An empty string clears it.
  const handleAvatarChange = async (dataUrl: string | null) => {
    if (!settings || busy) return;
    setBusy("avatar");
    try {
      const updated = await getStorage().settings.update(settings.user_id, {
        avatar: dataUrl ?? "",
      });
      onSettingsChange(updated);
      // #579 — refresh the header NavAvatar live.
      notifyProfileUpdated();
      notify.success(t("settings.saved", "Saved."));
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : t("common.error");
      notify.error(detail);
    } finally {
      setBusy(null);
    }
  };

  // #579 — persist the edited display name on the user object (the
  // existing store; both storage modes handle ``name``). Updates the
  // InitialsAvatar (via ``userName``) and the header NavAvatar (event) live.
  const handleSaveName = async () => {
    const userId = readLearnerState().userId;
    if (!userId || busy) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError(t("settings.username_empty", "Name cannot be empty."));
      return;
    }
    const name = trimmed.slice(0, 50);
    setNameError(null);
    setBusy("name");
    try {
      await getStorage().users.update(userId, { name });
      setUserName(name);
      setNameDraft(name);
      notifyProfileUpdated();
      notify.success(t("settings.saved", "Saved."));
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : t("common.error");
      notify.error(detail);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <section
        className="settings-section"
        data-testid="settings-section-profile"
        hidden={!active}
      >
        <h2 className="settings-section-title">{t("settings.section_profile", "Profile")}</h2>
        <div className="form-row" data-testid="settings-username-row">
          <label className="form-label" htmlFor="settings-username-input">
            {t("settings.username_label", "Display name")}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="settings-username-input"
              data-testid="settings-username-input"
              value={nameDraft}
              maxLength={50}
              placeholder={t("settings.username_placeholder", "Your name")}
              disabled={busy === "name"}
              aria-invalid={nameError ? true : undefined}
              onChange={(e) => {
                setNameDraft(e.target.value);
                if (nameError) setNameError(null);
              }}
              className="max-w-xs"
            />
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              onClick={() => void handleSaveName()}
              disabled={busy === "name" || nameDraft.trim() === userName}
              data-testid="settings-username-save"
            >
              {t("settings.username_save", "Save")}
            </Button>
          </div>
          {nameError && (
            <p
              role="alert"
              className="m-0 text-sm font-medium text-[var(--error)]"
              data-testid="settings-username-error"
            >
              {nameError}
            </p>
          )}
        </div>
        {settings && (
          <AvatarUpload
            name={userName}
            value={settings.avatar}
            size={96}
            uploadLabel={t("settings.avatar_upload", "Upload picture")}
            removeLabel={t("settings.avatar_remove", "Remove")}
            cropLabels={{
              title: t("settings.avatar_crop_title", "Adjust your picture"),
              instructions: t(
                "settings.avatar_crop_instructions",
                "Drag to reposition, scroll or pinch to zoom.",
              ),
              confirm: t("settings.avatar_crop_apply", "Apply"),
              cancel: t("settings.avatar_crop_cancel", "Cancel"),
              zoom: t("settings.avatar_crop_zoom", "Zoom"),
            }}
            previewLabels={{
              title: t("settings.avatar_preview_title", "Profile picture"),
              change: t("settings.avatar_change", "Change picture"),
              close: t("common.close", "Close"),
            }}
            avatarButtonLabel={t(
              "settings.avatar_button_label",
              "View or change profile picture",
            )}
            onChange={(dataUrl) => void handleAvatarChange(dataUrl)}
            onError={(key) =>
              notify.error(t(key, "Could not use that image. Try another file."))
            }
            testId="settings-avatar-upload"
          />
        )}
      </section>

      <section
        className="settings-section"
        data-testid="settings-section-appearance"
        hidden={!active}
      >
        <h2 className="settings-section-title">{t("settings.section_appearance", "Appearance")}</h2>
        <ThemePicker />
        {/* #1257 — global content-view preference (list/grid). Shares the
            same source as the in-tab quick-toggle. */}
        <ContentViewControl />
      </section>

      <div hidden={!active}>
        {/* #1378 — configurable order of the Content-area tabs. */}
        <ContentTabsOrderControl />
      </div>

      <section className="settings-section" hidden={!active}>
        <h2 className="settings-section-title">{t("settings.section_language", "Language")}</h2>
        <div className="form-row">
          <span className="form-label" id="settings-language-label">
            {t("settings.language_label", "Display language")}
          </span>
          <div style={{ minWidth: "16rem", flex: 1 }}>
            <LanguagePicker
              testId="settings-language"
              languages={buildLanguageOptions(t)}
              selectedValue={lang}
              disabled={busy === "lang"}
              onChange={handleLangChange}
              ariaLabel={t("settings.language_label", "Display language")}
              searchPlaceholder={t(
                "settings.language_search_placeholder",
                "Search languages…",
              )}
              searchAriaLabel={t("settings.language_search_label", "Search languages")}
              noResultsLabel={t("settings.language_no_results", "No languages found")}
            />
          </div>
        </div>
      </section>

      <section
        className="settings-section"
        data-testid="settings-section-ui"
        hidden={!active}
      >
        <h2 className="settings-section-title">{t("settings.section_ui", "Interface")}</h2>
        <label className="form-row form-row-toggle">
          <span className="form-label-stack">
            <span className="form-label">
              {t("settings.button_tooltips", "Show button tooltips")}
            </span>
            <span className="form-hint">
              {t(
                "settings.button_tooltips_description",
                "Show a hover tooltip on icon buttons explaining what they do. Screen-reader labels stay on regardless.",
              )}
            </span>
          </span>
          <input
            type="checkbox"
            data-testid="settings-button-tooltips-toggle"
            checked={buttonTooltipsOn}
            onChange={(e) => handleButtonTooltipsToggle(e.target.checked)}
          />
        </label>
        <label className="form-row form-row-toggle">
          <span className="form-label-stack">
            <span className="form-label">{t("settings.developer_mode", "Developer Mode")}</span>
            <span className="form-hint">
              {t(
                "settings.developer_mode_description",
                "Show full technical detail (status code, endpoint, stack trace) in error toasts. A 'DEV' badge appears in the navigation bar while this is on. Off by default; opt-in for debugging.",
              )}
            </span>
          </span>
          <input
            type="checkbox"
            data-testid="settings-developer-mode-toggle"
            checked={devModeOn}
            onChange={(e) => handleDevModeToggle(e.target.checked)}
          />
        </label>
      </section>

      <section
        className="settings-section"
        data-testid="settings-storage-mode"
        // Hidden on a Dexie-only build (GH Pages / installed PWA): there is no
        // backend, so the Server option does not exist and the mode is forced
        // to Dexie (#907).
        hidden={!active || isDexieOnlyBuild()}
      >
        <h2 className="settings-section-title">
          {t("settings.section_storage_mode", "Storage mode")}
        </h2>
        <p className="muted">
          {t(
            "settings.storage_mode_help",
            "Choose where your data lives. Local mode keeps everything in this browser; Server mode talks to the AdaptiveLearner backend.",
          )}
        </p>
        <fieldset className="storage-mode-fieldset">
          <label className="storage-mode-option">
            <input
              type="radio"
              name="storage-mode"
              value="api"
              data-testid="storage-mode-api"
              checked={currentMode === "api"}
              onChange={() => handleStorageModeChange("api")}
            />
            <span>
              <strong>{t("settings.storage_mode_api", "Server")}</strong>
              <span className="muted">
                {t("settings.storage_mode_api_hint", "Requires a running AdaptiveLearner backend.")}
              </span>
            </span>
          </label>
          <label className="storage-mode-option">
            <input
              type="radio"
              name="storage-mode"
              value="dexie"
              data-testid="storage-mode-dexie"
              checked={currentMode === "dexie"}
              onChange={() => handleStorageModeChange("dexie")}
            />
            <span>
              <strong>{t("settings.storage_mode_dexie", "Local (Browser)")}</strong>
              <span className="muted">
                {t(
                  "settings.storage_mode_dexie_hint",
                  "Data + API keys live in this browser; AI calls fire direct from the page.",
                )}
              </span>
            </span>
          </label>
        </fieldset>
        <p className="storage-mode-warning" data-testid="storage-mode-warning">
          {t(
            "settings.storage_mode_warning",
            "Data is NOT synced between modes. Sync is planned for a future version.",
          )}
        </p>
        {currentMode === "dexie" && rowCounts && (
          <ul className="storage-mode-counts" data-testid="storage-mode-counts">
            {Object.entries(rowCounts).map(([table, count]) => (
              <li key={table}>
                <span className="storage-mode-table">{table}</span>
                <span className="storage-mode-count">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* #840 — desktop/API-mode update preferences. Hidden in Dexie/PWA
          mode (that path uses the service worker, no GitHub check). */}
      {currentMode === "api" && (
        <div hidden={!active}>
          <UpdatesSettingsSection />
        </div>
      )}

      {/* #1455 - installing the PWA configures HOW the app runs
          (standalone window, homescreen, starts without network), so it
          belongs with the app-wide options here, not in the Data tab
          (which governs WHAT the app stores). Part of the PWA cluster:
          storage mode -> updates -> install -> mode indicator. */}
      <div hidden={!active}>
        <InstallAppSection />
      </div>

      <div hidden={!active}>
        <ModeIndicator />
      </div>
    </>
  );
}
