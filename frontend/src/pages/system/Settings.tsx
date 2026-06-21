import { useEffect, useMemo, useState } from "react";
import { Monitor } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../../api/client";
import AboutTab from "../../components/about/AboutTab";
import IdentitySection from "../../components/about/IdentitySection";
import BackupSection from "../../components/settings/backup/BackupSection";
import CacheManagementSection from "../../components/settings/data/CacheManagementSection";
import InstallAppSection from "../../components/settings/data/InstallAppSection";
import ContentRepoSettingsSection from "../../components/settings/integrations/ContentRepoSettingsSection";
import DangerZoneSection from "../../components/settings/data/DangerZoneSection";
import ExportSection from "../../components/settings/data/ExportSection";
import GitHubIntegrationSection from "../../components/settings/integrations/GitHubIntegrationSection";
import FeedbackIntensityControl from "../../components/settings/controls/FeedbackIntensityControl";
import GamificationSettingsSection from "../../components/settings/controls/GamificationSettingsSection";
import DirectionStrategyControl from "../../components/settings/controls/DirectionStrategyControl";
import MatchingResolveControl from "../../components/settings/controls/MatchingResolveControl";
import SrsTransparencySection from "../../components/session/SrsTransparencySection";
import DailyRemindersControl from "../../components/settings/controls/DailyRemindersControl";
import HintSettingsControl from "../../components/settings/controls/HintSettingsControl";
import ReviewSettingsControl from "../../components/settings/controls/ReviewSettingsControl";
import LearningProfileControl from "../../components/LearningProfileControl";
import MaxLessonSizeControl from "../../components/settings/controls/MaxLessonSizeControl";
import PausedLessonsRetentionControl from "../../components/settings/controls/PausedLessonsRetentionControl";
import LearningRepoSettingsSection from "../../components/settings/integrations/LearningRepoSettingsSection";
import MissionSettingsControl from "../../components/settings/controls/MissionSettingsControl";
import SourceLanguagesControl from "../../components/settings/controls/SourceLanguagesControl";
import ModeIndicator from "../../components/ModeIndicator";
import UpdatesSettingsSection from "../../components/settings/UpdatesSettingsSection";
import SoundSettingsControl from "../../components/settings/controls/SoundSettingsControl";
import HelpBrowser from "../../components/help/HelpBrowser";
import { setButtonTooltipsEnabled, useButtonTooltips } from "../../hooks/settings/useButtonTooltips";
import { setDevModeEnabled, useDevMode } from "../../hooks/settings/useDevMode";
import { Feature } from "@astrapi69/feature-strategy-react";
import { FEATURES } from "../../features/featureConfig";
import VoiceSettingsSection from "../../components/voice/VoiceSettingsSection";
import AiSettingsPanel from "../../components/settings/ai/AiSettingsPanel";
import SyncSection from "../../components/sync/SyncSection";
import ThemePicker from "../../components/settings/appearance/ThemePicker";
import AvatarUpload from "../../shared/media/AvatarUpload";
import SelectiveExportSection from "../../components/settings/data/SelectiveExportSection";
import SettingsSidebar from "../../components/settings/SettingsSidebar";
import SettingsMobileMenu from "../../components/settings/SettingsMobileMenu";
import type { SidebarGroup } from "../../lib/settings/sidebar-model";
import { useI18n } from "../../hooks/ui/useI18n";
import { buildLanguageOptions } from "../../lib/languages";
import LanguagePicker from "../../shared/forms/LanguagePicker";
import { readGesturePref, writeGesturePref } from "../../lib/gesturePref";
import {
  readLessonShortcutsEnabled,
  setLessonShortcutsEnabled,
} from "../../lib/lesson/lessonShortcutsPref";
import { readLearnerState, setLanguage } from "../../lib/learnerState";
import { notifyProfileUpdated } from "../../lib/profileSignal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getStorage,
  getStorageRowCounts,
  isDexieOnlyBuild,
  resolveStorageMode,
  setPersistedStorageMode,
  type StorageMode,
} from "../../storage";
import { notify } from "../../utils/notify";
import type { UserSettings } from "../../types";

/**
 * Settings page (project-reference §8 row ``/settings``).
 *
 * The page shell loads ``UserSettings`` and owns the general-tab
 * controls (appearance, display language, interface toggles, storage
 * mode) plus the language switch (PATCH /api/settings/{user_id}). The
 * other tabs compose dedicated section components; the AI tab (active
 * provider, model overrides, API keys) lives in {@link AiSettingsPanel}
 * backed by {@link useAiKeySettings}. The page never sees raw key
 * ciphertext — ``UserSettingsOut`` only exposes ``has_<provider>_key``
 * flags.
 *
 * Pre-condition: user_id in localStorage; missing redirects to
 * /onboarding.
 *
 * v1.39.0 / Phase 56M — tabbed layout (Bibliogon pattern). Every
 * panel stays MOUNTED (inactive ones use the ``hidden`` attribute)
 * so deep links + existing data-testid assertions keep working;
 * the tab bar just controls which group is visible, for
 * discoverability.
 */
const SETTINGS_TABS = [
  "general",
  "ai",
  "learning",
  "plugins",
  "data",
  "integrations",
  "help",
  "about",
] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
  return value !== null && (SETTINGS_TABS as readonly string[]).includes(value);
}

const SETTINGS_TAB_LABELS: Record<SettingsTab, { key: string; fallback: string }> = {
  general: { key: "settings.tab_general", fallback: "General" },
  ai: { key: "settings.tab_ai", fallback: "AI" },
  learning: { key: "settings.tab_learning", fallback: "Learning" },
  plugins: { key: "settings.tab_plugins", fallback: "Plugins" },
  data: { key: "settings.tab_data", fallback: "Data" },
  integrations: {
    key: "settings.tab_integrations",
    fallback: "Integrations",
  },
  help: { key: "settings.tab_help", fallback: "Help" },
  about: { key: "settings.tab_about", fallback: "About" },
};

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  // Tab state lives in the URL (?tab=general) so deep links + browser
  // back/forward work and a refresh keeps the open tab. Default + any
  // unknown value falls back to "general".
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: SettingsTab = isSettingsTab(searchParams.get("tab"))
    ? (searchParams.get("tab") as SettingsTab)
    : "general";
  const setActiveTab = (tab: string) => {
    setSearchParams(
      (prev) => {
        prev.set("tab", tab);
        return prev;
      },
      { replace: true },
    );
  };

  // Shared nav model for both the desktop sidebar and the mobile menu
  // (#546). The 8 existing tabs are grouped; tabs are never removed.
  const sidebarGroups: SidebarGroup[] = useMemo(() => {
    const item = (tab: SettingsTab) => ({
      value: tab,
      label: t(SETTINGS_TAB_LABELS[tab].key, SETTINGS_TAB_LABELS[tab].fallback),
      testId: `settings-tab-${tab}`,
    });
    return [
      {
        key: "general",
        label: t("settings.group_general", "General"),
        items: [item("general")],
      },
      {
        key: "learning",
        label: t("settings.group_learning", "Learning & AI"),
        items: [item("learning"), item("ai"), item("plugins")],
      },
      {
        key: "data",
        label: t("settings.group_data", "Data & integrations"),
        items: [item("data"), item("integrations")],
      },
      {
        key: "info",
        label: t("settings.group_info", "Info"),
        items: [item("help"), item("about")],
      },
    ];
  }, [t]);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  // #508 — the learner's display name for the initials-avatar fallback.
  const [userName, setUserName] = useState<string>("");
  // #579 — editable display-name draft + validation message.
  const [nameDraft, setNameDraft] = useState<string>("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // v1.10.0 / Phase 23E — swipe-gesture toggle. Persisted in
  // localStorage via ``gesturePref`` so the consumer hooks
  // (Assessment, Curriculum, Session) read the same flag.
  const [gesturesOn, setGesturesOn] = useState<boolean>(() => readGesturePref());

  const handleGesturesToggle = (next: boolean) => {
    setGesturesOn(next);
    writeGesturePref(next);
  };

  // Lesson Enter-key shortcut (#103). localStorage-backed so the
  // lesson player (``useLessonShortcuts``) reads the same flag.
  const [lessonShortcutsOn, setLessonShortcutsOn] = useState<boolean>(() =>
    readLessonShortcutsEnabled(),
  );

  const handleLessonShortcutsToggle = (next: boolean) => {
    setLessonShortcutsOn(next);
    setLessonShortcutsEnabled(next);
  };

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
  // Per-operation busy marker for the language switch. The AI tab owns
  // its own busy state inside ``useAiKeySettings``.
  const [busy, setBusy] = useState<string | null>(null);

  // Phase 10F: storage-mode toggle. ``currentMode`` reflects
  // what's active *right now* (snapshot at mount). ``pendingMode``
  // tracks an in-flight choice the user has selected but not
  // committed; switching is "persist + reload required" since
  // live-swap would orphan in-memory state.
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

  useEffect(() => {
    const userId = readLearnerState().userId;
    if (!userId) {
      navigate("/onboarding", { replace: true });
      return;
    }
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
    getStorage()
      .settings.get(userId)
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = err instanceof ApiError ? err.detail : t("common.error");
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
      const updated = await getStorage().settings.update(settings.user_id, {
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

  // #508 — set / clear the profile picture. An empty string clears it.
  const handleAvatarChange = async (dataUrl: string | null) => {
    if (!settings || busy) return;
    setBusy("avatar");
    try {
      const updated = await getStorage().settings.update(settings.user_id, {
        avatar: dataUrl ?? "",
      });
      setSettings(updated);
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

  if (loadError) {
    return (
      <main id="main" data-testid="settings-error" className="settings-page">
        <p className="error-text" role="alert">
          {loadError}
        </p>
      </main>
    );
  }
  if (!settings) {
    return (
      <main id="main" data-testid="settings-loading" className="settings-page">
        <p className="muted" role="status">
          {t("common.loading", "Loading…")}
        </p>
      </main>
    );
  }

  return (
    <main id="main" data-testid="settings" className="settings-page">
      <header>
        <h1>{t("settings.title", "Settings")}</h1>
      </header>

      <SettingsMobileMenu
        groups={sidebarGroups}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className="mx-auto grid w-full max-w-[1180px] gap-0 md:grid-cols-[220px_1fr] md:gap-8">
        <SettingsSidebar
          groups={sidebarGroups}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
        <div className="min-w-0">

      <section
        className="settings-section"
        data-testid="settings-section-profile"
        hidden={activeTab !== "general"}
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
        hidden={activeTab !== "general"}
      >
        <h2 className="settings-section-title">{t("settings.section_appearance", "Appearance")}</h2>
        <ThemePicker />
      </section>

      <section className="settings-section" hidden={activeTab !== "general"}>
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
        hidden={activeTab !== "general"}
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

      <AiSettingsPanel
        settings={settings}
        onSettingsChange={setSettings}
        active={activeTab === "ai"}
      />

      <section
        className="settings-section"
        data-testid="settings-storage-mode"
        // Hidden on a Dexie-only build (GH Pages / installed PWA): there is no
        // backend, so the Server option does not exist and the mode is forced
        // to Dexie (#907).
        hidden={activeTab !== "general" || isDexieOnlyBuild()}
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
        <div hidden={activeTab !== "general"}>
          <UpdatesSettingsSection />
        </div>
      )}

      <div hidden={activeTab !== "general"}>
        <ModeIndicator />
      </div>

      {/* --- Learning tab ----------------------------------- */}
      <div
        className="settings-tabpanel"
        role="tabpanel"
        hidden={activeTab !== "learning"}
        data-testid="settings-panel-learning"
      >
        <SourceLanguagesControl />
        <LearningProfileControl />
        <section className="settings-section" data-testid="settings-section-feedback">
          <h2 className="settings-section-title">{t("settings.section_feedback", "Feedback")}</h2>
          <FeedbackIntensityControl />
          <SoundSettingsControl />
        </section>
        <MissionSettingsControl />
        <DirectionStrategyControl />
        <MatchingResolveControl />
        <HintSettingsControl />
        <ReviewSettingsControl />
        <SrsTransparencySection />
        <DailyRemindersControl />
        <PausedLessonsRetentionControl />
        <MaxLessonSizeControl />
        <VoiceSettingsSection />
        <section className="settings-section">
          <h2 className="settings-section-title">
            {t("settings.section_interaction", "Interaction")}
          </h2>
          <label className="form-row form-row-toggle">
            <span className="form-label-stack">
              <span className="form-label">{t("settings.gestures", "Swipe Gestures")}</span>
              <span className="form-hint">
                {t(
                  "settings.gestures_description",
                  "Swipe to navigate in Assessment, Session, and Curriculum.",
                )}
              </span>
            </span>
            <input
              type="checkbox"
              data-testid="settings-gestures-toggle"
              checked={gesturesOn}
              onChange={(e) => handleGesturesToggle(e.target.checked)}
            />
          </label>
          <label className="form-row form-row-toggle">
            <span className="form-label-stack">
              <span className="form-label">
                {t("settings.lesson_shortcuts", "Lesson keyboard shortcuts")}
              </span>
              <span className="form-hint">
                {t(
                  "settings.lesson_shortcuts_description",
                  "Press Enter to check your answer, then Enter again to go to the next step.",
                )}
              </span>
            </span>
            <input
              type="checkbox"
              data-testid="settings-lesson-shortcuts-toggle"
              checked={lessonShortcutsOn}
              onChange={(e) => handleLessonShortcutsToggle(e.target.checked)}
            />
          </label>
        </section>
      </div>

      {/* --- Plugins tab ------------------------------------ */}
      <div
        className="settings-tabpanel"
        role="tabpanel"
        hidden={activeTab !== "plugins"}
        data-testid="settings-panel-plugins"
      >
        <GamificationSettingsSection />
        <LearningRepoSettingsSection />
      </div>

      {/* --- Data tab --------------------------------------- */}
      <div
        className="settings-tabpanel"
        role="tabpanel"
        hidden={activeTab !== "data"}
        data-testid="settings-panel-data"
      >
        {/* Sync needs a reachable backend (pairing token + sync
            endpoints). In Dexie mode (GitHub Pages / PWA-only) there
            is none, so the controls are replaced by a notice that the
            desktop app carries the feature — visible, not hidden, per
            the feature-state policy (#335, supersedes #51). */}
        <Feature
          id={FEATURES.SYNC}
          whenDisabled={
            <section
              className="settings-section mt-6"
              data-testid="settings-sync-desktop-only"
            >
              <h2 className="settings-section-title">{t("settings.section_sync", "Sync")}</h2>
              <div className="flex items-start gap-2 rounded-app border border-border bg-card px-3 py-2 text-sm text-fg-secondary">
                <Monitor size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>
                  {t("feature.desktop_only", "Only available with the desktop app.")}
                </span>
              </div>
            </section>
          }
        >
          <SyncSection />
        </Feature>
        <BackupSection />
        <Feature id={FEATURES.SELECTIVE_EXPORT}>
          <SelectiveExportSection />
        </Feature>
        <ExportSection />
        {resolveStorageMode() === "api" && <IdentitySection t={t} />}
        <ContentRepoSettingsSection />
        <CacheManagementSection />
        <InstallAppSection />
        <DangerZoneSection />
      </div>

      {/* --- Integrations tab (GitHub) ---------------------- */}
      <div
        className="settings-tabpanel"
        role="tabpanel"
        hidden={activeTab !== "integrations"}
        data-testid="settings-panel-integrations"
      >
        <GitHubIntegrationSection />
      </div>

      {/* --- Help tab (glossary / article browser) ---------- */}
      <div
        className="settings-tabpanel"
        role="tabpanel"
        hidden={activeTab !== "help"}
        data-testid="settings-panel-help"
      >
        <HelpBrowser />
      </div>

      {/* --- About tab (version / system / credits / license) */}
      <div
        className="settings-tabpanel"
        role="tabpanel"
        hidden={activeTab !== "about"}
        data-testid="settings-panel-about"
      >
        <AboutTab />
      </div>
        </div>
      </div>
    </main>
  );
}
