import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../api/client";
import {Input} from "@/components/ui/input";
import AboutTab from "../components/about/AboutTab";
import IdentitySection from "../components/about/IdentitySection";
import BackupSection from "../components/BackupSection";
import CacheManagementSection from "../components/CacheManagementSection";
import DangerZoneSection from "../components/DangerZoneSection";
import ExportSection from "../components/ExportSection";
import FeedbackIntensityControl from "../components/FeedbackIntensityControl";
import GamificationSettingsSection from "../components/GamificationSettingsSection";
import DirectionStrategyControl from "../components/DirectionStrategyControl";
import MaxLessonSizeControl from "../components/MaxLessonSizeControl";
import PausedLessonsRetentionControl from "../components/PausedLessonsRetentionControl";
import LearningRepoSettingsSection from "../components/LearningRepoSettingsSection";
import MissionSettingsControl from "../components/MissionSettingsControl";
import SourceLanguagesControl from "../components/SourceLanguagesControl";
import ModeIndicator from "../components/ModeIndicator";
import SoundSettingsControl from "../components/SoundSettingsControl";
import HelpBrowser from "../components/help/HelpBrowser";
import {
  setButtonTooltipsEnabled,
  useButtonTooltips,
} from "../hooks/useButtonTooltips";
import { setDevModeEnabled, useDevMode } from "../hooks/useDevMode";
import VoiceSettingsSection from "../components/VoiceSettingsSection";
import { ModelPicker } from "../components/ModelPicker";
import SyncSection from "../components/SyncSection";
import ThemePicker from "../components/ThemePicker";
import { DEFAULT_MODELS } from "../storage/ai-providers";
import { useI18n } from "../hooks/useI18n";
import {
  AI_PROVIDERS,
  MODEL_SUGGESTIONS,
  SUPPORTED_LANGUAGES,
  type AIProvider,
} from "../lib/constants";
import { API_KEY_PREFIX, isValidApiKeyFormat } from "../lib/apiKeyFormat";
import type { ApiKeyTestResult } from "../storage/types";
import { readGesturePref, writeGesturePref } from "../lib/gesturePref";
import { readLearnerState, setLanguage } from "../lib/learnerState";
import {
  getStorage,
  getStorageRowCounts,
  resolveStorageMode,
  setPersistedStorageMode,
  type StorageMode,
} from "../storage";
import { notify } from "../utils/notify";
import type { UserSettings } from "../types";

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
  "help",
  "about",
] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
  return value !== null && (SETTINGS_TABS as readonly string[]).includes(value);
}

const SETTINGS_TAB_LABELS: Record<
  SettingsTab,
  { key: string; fallback: string }
> = {
  general: { key: "settings.tab_general", fallback: "General" },
  ai: { key: "settings.tab_ai", fallback: "AI" },
  learning: { key: "settings.tab_learning", fallback: "Learning" },
  plugins: { key: "settings.tab_plugins", fallback: "Plugins" },
  data: { key: "settings.tab_data", fallback: "Data" },
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
  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams(
      (prev) => {
        prev.set("tab", tab);
        return prev;
      },
      { replace: true },
    );
  };

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // v1.10.0 / Phase 23E — swipe-gesture toggle. Persisted in
  // localStorage via ``gesturePref`` so the consumer hooks
  // (Assessment, Curriculum, Session) read the same flag.
  const [gesturesOn, setGesturesOn] = useState<boolean>(() =>
    readGesturePref(),
  );

  const handleGesturesToggle = (next: boolean) => {
    setGesturesOn(next);
    writeGesturePref(next);
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
  const [keyDrafts, setKeyDrafts] = useState<Record<AIProvider, string>>({
    anthropic: "",
    openai: "",
    gemini: "",
  });
  // v0.4.0 — local drafts for the model-override inputs. The
  // committed value lives on ``settings.model_override_<provider>``;
  // the draft is the user's in-flight edit before they hit Save.
  const [modelDrafts, setModelDrafts] = useState<Record<AIProvider, string>>({
    anthropic: "",
    openai: "",
    gemini: "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  // C2 — last live-test outcome per provider (null = not tested this
  // session). Drives the inline result line under the key row.
  const [testResults, setTestResults] = useState<
    Record<AIProvider, ApiKeyTestResult | null>
  >({ anthropic: null, openai: null, gemini: null });
  // C4 — when an auto-test on save fails, this holds the provider +
  // failure kind so the inline rollback panel (keep old / save anyway
  // / cancel) renders for that provider.
  const [rollbackPrompt, setRollbackPrompt] = useState<{
    provider: AIProvider;
    kind: ApiKeyTestResult["kind"];
  } | null>(null);
  // C4 — whether a last-known-good backup exists per provider (drives
  // the "restore last working key" affordance). Loaded after settings.
  const [backupAvailable, setBackupAvailable] = useState<
    Record<AIProvider, boolean>
  >({ anthropic: false, openai: false, gemini: false });

  // Phase 10F: storage-mode toggle. ``currentMode`` reflects
  // what's active *right now* (snapshot at mount). ``pendingMode``
  // tracks an in-flight choice the user has selected but not
  // committed; switching is "persist + reload required" since
  // live-swap would orphan in-memory state.
  const [currentMode] = useState<StorageMode>(() => resolveStorageMode());
  const [rowCounts, setRowCounts] = useState<Record<string, number> | null>(
    null,
  );

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
    getStorage()
      .settings.get(userId)
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setModelDrafts({
          anthropic: s.model_override_anthropic ?? "",
          openai: s.model_override_openai ?? "",
          gemini: s.model_override_gemini ?? "",
        });
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

  const handleProviderChange = async (provider: AIProvider) => {
    if (!settings || busy) return;
    setBusy("provider");
    try {
      const updated = await getStorage().settings.update(settings.user_id, {
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

  // C4 — persist a key (no test). Backs up the key as last-known-good
  // only when ``backup`` is true (i.e. it passed its test).
  const persistKey = async (
    provider: AIProvider,
    key: string,
    backup: boolean,
  ) => {
    const updated = await getStorage().settings.setApiKey(settings!.user_id, {
      provider,
      key,
    });
    if (backup) {
      await getStorage().settings.backupApiKey(settings!.user_id, {
        provider,
        key,
      });
      setBackupAvailable((prev) => ({ ...prev, [provider]: true }));
    }
    setSettings(updated);
    setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
    notify.success(t("toast.api_key_saved", "API key saved."));
  };

  // C4 — revised save flow: auto-test the new key BEFORE overwriting.
  // Passes -> save + back up. Fails -> rollback panel (the old key is
  // untouched because we tested without saving).
  const handleSaveKey = async (provider: AIProvider) => {
    if (!settings || busy) return;
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
    if (!settings || busy) return;
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
    if (!settings || busy) return;
    setBusy(`restore-${provider}`);
    setRollbackPrompt(null);
    try {
      const updated = await getStorage().settings.restoreApiKeyBackup(
        settings.user_id,
        provider,
      );
      setSettings(updated);
      setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
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
    if (!settings || busy) return;
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
    if (!settings || busy) return;
    const draft = modelDrafts[provider].trim();
    const current = settings[`model_override_${provider}`] ?? "";
    if (draft === current) return;
    setBusy(`save-model-${provider}`);
    try {
      const updated = await getStorage().settings.update(settings.user_id, {
        [`model_override_${provider}`]: draft,
      });
      setSettings(updated);
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
    if (!settings || busy) return;
    setBusy(`clear-model-${provider}`);
    try {
      const updated = await getStorage().settings.update(settings.user_id, {
        [`model_override_${provider}`]: "",
      });
      setSettings(updated);
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
    if (!settings || busy) return;
    const ok = window.confirm(
      t("settings.api_key_confirm_delete", "Really remove this API key?"),
    );
    if (!ok) return;
    setBusy(`delete-${provider}`);
    try {
      const updated = await getStorage().settings.deleteApiKey(
        settings.user_id,
        provider,
      );
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

      <nav
        className="settings-tabs"
        role="tablist"
        aria-label={t("settings.tabs_aria", "Settings sections")}
        data-testid="settings-tabs"
      >
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`settings-tab${activeTab === tab ? " is-active" : ""}`}
            data-testid={`settings-tab-${tab}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(SETTINGS_TAB_LABELS[tab].key, SETTINGS_TAB_LABELS[tab].fallback)}
          </button>
        ))}
      </nav>

      <section
        className="settings-section"
        data-testid="settings-section-appearance"
        hidden={activeTab !== "general"}
      >
        <h2 className="settings-section-title">
          {t("settings.section_appearance", "Appearance")}
        </h2>
        <ThemePicker />
      </section>

      <section className="settings-section" hidden={activeTab !== "general"}>
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

      <section
        className="settings-section"
        data-testid="settings-section-ui"
        hidden={activeTab !== "general"}
      >
        <h2 className="settings-section-title">
          {t("settings.section_ui", "Interface")}
        </h2>
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
            <span className="form-label">
              {t("settings.developer_mode", "Developer Mode")}
            </span>
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

      <section className="settings-section" hidden={activeTab !== "ai"}>
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

      <section
        className="settings-section"
        data-testid="settings-model-overrides"
        hidden={activeTab !== "ai"}
      >
        <h2 className="settings-section-title">
          {t("settings.section_model_overrides", "Model overrides")}
        </h2>
        <p className="muted">
          {t(
            "settings.model_overrides_hint",
            "Leave blank to use the default model for each provider. A non-empty value replaces the default at chat time.",
          )}
        </p>
        {AI_PROVIDERS.map((provider) => {
          const draft = modelDrafts[provider];
          const current = settings[`model_override_${provider}`] ?? "";
          const dirty = draft.trim() !== current;
          const isActive = settings.active_provider === provider;
          return (
            <div
              key={provider}
              className={`model-override-row${isActive ? " is-active-provider" : ""}`}
              data-testid={`model-override-row-${provider}`}
            >
              <div className="model-override-row-head">
                <strong>{t(`settings.provider_${provider}`, provider)}</strong>
                {isActive && (
                  <span
                    className="api-key-active-badge"
                    data-testid={`model-override-active-${provider}`}
                  >
                    {t("settings.provider_active", "Active")}
                  </span>
                )}
                <span
                  className={`api-key-status ${current ? "is-set" : "is-missing"}`}
                  data-testid={`model-override-status-${provider}`}
                >
                  {current
                    ? t("settings.model_override_set", "Override active")
                    : t("settings.model_override_default", "Default model")}
                </span>
              </div>
              <div className="model-override-row-input">
                <ModelPicker
                  userId={settings.user_id}
                  provider={provider}
                  value={current}
                  draft={draft}
                  onDraftChange={(next) =>
                    setModelDrafts((prev) => ({
                      ...prev,
                      [provider]: next,
                    }))
                  }
                  defaultModel={DEFAULT_MODELS[provider]}
                  staticSuggestions={MODEL_SUGGESTIONS[provider]}
                  disabled={busy === `save-model-${provider}`}
                  hasApiKey={
                    (settings[`has_${provider}_key`] as boolean) ?? false
                  }
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  data-testid={`model-override-save-${provider}`}
                  onClick={() => handleSaveModel(provider)}
                  disabled={busy === `save-model-${provider}` || !dirty}
                >
                  {t("settings.model_override_save", "Save model")}
                </button>
                {current && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid={`model-override-clear-${provider}`}
                    onClick={() => handleClearModel(provider)}
                    disabled={busy === `clear-model-${provider}`}
                  >
                    {t("settings.model_override_clear", "Use default")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="settings-section" hidden={activeTab !== "ai"}>
        <h2 className="settings-section-title">
          {t("settings.section_api_keys", "API keys")}
        </h2>
        {AI_PROVIDERS.map((provider) => {
          const has = settings[`has_${provider}_key`] as boolean;
          const isActive = settings.active_provider === provider;
          // Only an env-var-sourced key is truly read-only from
          // the UI: the user must change the environment, not the
          // app. A ``secrets.yaml`` key IS editable now that the
          // app writes to that file — saving overwrites it,
          // removing clears it. ``settings`` (DB) and ``none``
          // were always editable.
          const source = settings[`key_source_${provider}`];
          const externallyManaged = source === "env";
          const fromSecretsFile = source === "secrets_yaml";
          // C1 — instant format validation. ``empty`` = nothing typed
          // yet (no feedback); ``valid`` / ``invalid`` drive the border
          // colour, the inline hint, and the Save gate.
          const draft = keyDrafts[provider];
          const draftTrimmed = draft.trim();
          const formatState: "empty" | "valid" | "invalid" =
            draftTrimmed.length === 0
              ? "empty"
              : isValidApiKeyFormat(provider, draft)
                ? "valid"
                : "invalid";
          return (
            <div
              key={provider}
              className={`api-key-row${isActive ? " is-active-provider" : ""}`}
              data-testid={`api-key-row-${provider}`}
            >
              <div className="api-key-row-head">
                <strong>{t(`settings.provider_${provider}`, provider)}</strong>
                {isActive && (
                  <span
                    className="api-key-active-badge"
                    data-testid={`api-key-active-${provider}`}
                  >
                    {t("settings.provider_active", "Active")}
                  </span>
                )}
                <span
                  className={`api-key-status ${has ? "is-set" : "is-missing"}`}
                  data-testid={`api-key-status-${provider}`}
                >
                  {has
                    ? t("settings.api_key_saved", "Key stored")
                    : t("settings.api_key_missing", "Not set")}
                </span>
                <span
                  className={`api-key-source api-key-source-${source}`}
                  data-testid={`api-key-source-${provider}`}
                >
                  {source === "secrets_yaml"
                    ? t(
                        "settings.api_key_source_file",
                        "Key from: secrets.yaml",
                      )
                    : source === "env"
                      ? t(
                          "settings.api_key_source_env",
                          "Key from: environment",
                        )
                      : source === "settings"
                        ? t(
                            "settings.api_key_source_settings",
                            "Key from: Settings",
                          )
                        : t(
                            "settings.api_key_source_none",
                            "No key configured",
                          )}
                </span>
              </div>
              {externallyManaged && (
                <p
                  className="api-key-external-hint"
                  data-testid={`api-key-external-${provider}`}
                >
                  {t(
                    "settings.api_key_external_hint_env",
                    "This key is configured via the ADAPTIVE_LEARNER_{PROVIDER}_API_KEY environment variable.",
                  ).replace("{PROVIDER}", provider.toUpperCase())}
                </p>
              )}
              {fromSecretsFile && (
                <p
                  className="api-key-source-file-hint"
                  data-testid={`api-key-info-${provider}`}
                >
                  {t(
                    "settings.api_key_external_hint_file",
                    "Stored in ~/.config/adaptive_learner/secrets.yaml. Saving here overwrites it.",
                  )}
                </p>
              )}
              {isActive && !has && !externallyManaged && (
                <p
                  className="api-key-warning"
                  data-testid={`api-key-warning-${provider}`}
                >
                  {t(
                    "settings.active_provider_missing_key",
                    "This is your active provider but no API key is stored. AI replies will be skipped until a key is saved.",
                  )}
                </p>
              )}
              <div className="api-key-row-input">
                <span
                  className={`api-key-input-wrap api-key-format-${formatState}`}
                >
                  <Input
                    data-testid={`api-key-input-${provider}`}
                    type="password"
                    placeholder={
                      has && !externallyManaged
                        ? t(
                            "settings.api_key_placeholder_replace",
                            "Paste a new key to replace the stored one…",
                          )
                        : t("settings.api_key_placeholder", "Paste here…")
                    }
                    aria-label={`${t("settings.api_key_label", "API key")} (${provider})`}
                    aria-invalid={formatState === "invalid"}
                    autoComplete="off"
                    value={keyDrafts[provider]}
                    onChange={(e) =>
                      setKeyDrafts((prev) => ({
                        ...prev,
                        [provider]: e.target.value,
                      }))
                    }
                    disabled={busy === `save-${provider}` || externallyManaged}
                  />
                  {formatState === "valid" && (
                    <span
                      className="api-key-format-check"
                      data-testid={`api-key-format-ok-${provider}`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  data-testid={`api-key-save-${provider}`}
                  onClick={() => handleSaveKey(provider)}
                  disabled={
                    busy === `save-${provider}` ||
                    formatState !== "valid" ||
                    externallyManaged
                  }
                >
                  {t("settings.api_key_set", "Save key")}
                </button>
                {(has || formatState === "valid") && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid={`api-key-test-${provider}`}
                    onClick={() => handleTestKey(provider)}
                    disabled={busy === `test-${provider}`}
                  >
                    {busy === `test-${provider}` && (
                      <span className="btn-spinner" aria-hidden="true" />
                    )}
                    {busy === `test-${provider}`
                      ? t("settings.api_key.testing", "Testing…")
                      : t("settings.api_key.test", "Test")}
                  </button>
                )}
                {has && !externallyManaged && (
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
              {testResults[provider] && (
                <p
                  className={`api-key-test-result ${
                    testResults[provider]!.kind === "ok"
                      ? "is-ok"
                      : testResults[provider]!.kind === "invalid"
                        ? "is-invalid"
                        : "is-warning"
                  }`}
                  data-testid={`api-key-test-result-${provider}`}
                  role="status"
                >
                  {testResults[provider]!.kind === "ok"
                    ? `✓ ${t("settings.api_key.test_success", "Key works!")}`
                    : testResults[provider]!.kind === "invalid"
                      ? `✗ ${t("settings.api_key.test_invalid", "Key invalid or expired.")}`
                      : testResults[provider]!.kind === "rate_limit"
                        ? `⚠ ${t("settings.api_key.test_rate_limit", "Rate limit hit. Try later.")}`
                        : testResults[provider]!.kind === "no_key"
                          ? `⚠ ${t("settings.api_key.test_no_key", "No key to test.")}`
                          : `⚠ ${t("settings.api_key.test_network", "Connection failed. Check your internet connection.")}`}
                </p>
              )}
              {formatState === "invalid" && (
                <p
                  className="api-key-format-error"
                  data-testid={`api-key-format-error-${provider}`}
                >
                  {t("settings.api_key.format_invalid", "Invalid format.")}{" "}
                  {t(
                    `settings.api_key.format_hint.${provider}`,
                    `Starts with ${API_KEY_PREFIX[provider]}`,
                  )}
                </p>
              )}
              {rollbackPrompt?.provider === provider && (
                <div
                  className="api-key-rollback"
                  data-testid={`api-key-rollback-${provider}`}
                  role="alertdialog"
                  aria-label={t(
                    "settings.api_key.rollback_warning",
                    "The new key doesn't work. Keep the old key?",
                  )}
                >
                  <p className="api-key-rollback-message">
                    {t(
                      "settings.api_key.rollback_warning",
                      "The new key doesn't work. Keep the old key?",
                    )}
                  </p>
                  <div className="api-key-rollback-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      data-testid={`api-key-rollback-keep-${provider}`}
                      onClick={() => handleKeepOldKey(provider)}
                    >
                      {t("settings.api_key.rollback_keep_old", "Keep old key")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      data-testid={`api-key-rollback-save-anyway-${provider}`}
                      onClick={() => handleSaveAnyway(provider)}
                      disabled={busy === `save-${provider}`}
                    >
                      {t("settings.api_key.rollback_save_anyway", "Save anyway")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-link"
                      data-testid={`api-key-rollback-cancel-${provider}`}
                      onClick={handleDismissRollback}
                    >
                      {t("settings.api_key.rollback_cancel", "Cancel")}
                    </button>
                    {backupAvailable[provider] && (
                      <button
                        type="button"
                        className="btn btn-link"
                        data-testid={`api-key-restore-${provider}`}
                        onClick={() => handleRestoreBackup(provider)}
                        disabled={busy === `restore-${provider}`}
                      >
                        {t(
                          "settings.api_key.rollback_restore",
                          "Restore last working key",
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {backupAvailable[provider] &&
                rollbackPrompt?.provider !== provider &&
                testResults[provider] &&
                !testResults[provider]!.success && (
                  <button
                    type="button"
                    className="btn btn-link api-key-restore-link"
                    data-testid={`api-key-restore-link-${provider}`}
                    onClick={() => handleRestoreBackup(provider)}
                    disabled={busy === `restore-${provider}`}
                  >
                    {t(
                      "settings.api_key.rollback_restore",
                      "Restore last working key",
                    )}
                  </button>
                )}
            </div>
          );
        })}
      </section>

      <section
        className="settings-section"
        data-testid="settings-storage-mode"
        hidden={activeTab !== "general"}
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
                {t(
                  "settings.storage_mode_api_hint",
                  "Requires a running AdaptiveLearner backend.",
                )}
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
              <strong>
                {t("settings.storage_mode_dexie", "Local (Browser)")}
              </strong>
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
        <section
          className="settings-section"
          data-testid="settings-section-feedback"
        >
          <h2 className="settings-section-title">
            {t("settings.section_feedback", "Feedback")}
          </h2>
          <FeedbackIntensityControl />
          <SoundSettingsControl />
        </section>
        <MissionSettingsControl />
        <SourceLanguagesControl />
        <DirectionStrategyControl />
        <PausedLessonsRetentionControl />
        <MaxLessonSizeControl />
        <VoiceSettingsSection />
        <section className="settings-section">
          <h2 className="settings-section-title">
            {t("settings.section_interaction", "Interaction")}
          </h2>
          <label className="form-row form-row-toggle">
            <span className="form-label-stack">
              <span className="form-label">
                {t("settings.gestures", "Swipe Gestures")}
              </span>
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
        <SyncSection />
        <BackupSection />
        <ExportSection />
        {resolveStorageMode() === "api" && <IdentitySection t={t} />}
        <CacheManagementSection />
        <DangerZoneSection />
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
    </main>
  );
}
