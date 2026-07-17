import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../../api/client";
import AiSettingsPanel from "../../components/settings/ai/AiSettingsPanel";
import SettingsSidebar from "../../components/settings/SettingsSidebar";
import SettingsMobileMenu from "../../components/settings/SettingsMobileMenu";
import type { SidebarGroup } from "../../lib/settings/sidebar-model";
import { useI18n } from "../../hooks/ui/useI18n";
import { readLearnerState } from "../../lib/learning/learnerState";
import { subscribeSettingsRefresh } from "../../lib/settings/settings-refresh-bus";
import { getStorage } from "../../storage";
import type { UserSettings } from "../../types";
import {
  AboutPanel,
  DataPanel,
  GeneralPanel,
  HelpPanel,
  IntegrationsPanel,
  LearningPanel,
  PluginsPanel,
} from "./settings/tabs";

/**
 * Settings page (project-reference §8 row ``/settings``).
 *
 * The page shell loads ``UserSettings`` and composes one panel per tab
 * from {@link ./settings/tabs} (#1447). Each panel owns its own controls
 * and state; the shell keeps only what is shared or cross-cutting: the
 * loaded settings (passed to the General + AI panels), the active-tab /
 * ``?tab=`` URL state, and the sidebar / mobile-menu nav model. The AI tab
 * (active provider, model overrides, API keys) lives in
 * {@link AiSettingsPanel} backed by {@link useAiKeySettings}; the General
 * tab owns the profile / appearance / language / interface / storage-mode
 * controls in {@link GeneralPanel}. The page never sees raw key ciphertext
 * — ``UserSettingsOut`` only exposes ``has_<provider>_key`` flags.
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
  const { t } = useI18n();
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

  // The encrypted key export (.alk) lives on the Data tab (#1183); the AI
  // tab only links to it. Switch tabs, then bring the section into view —
  // panels stay mounted (hidden), so the node already exists in the DOM.
  // ``scrollIntoView`` is guarded for happy-dom.
  const openKeyExport = () => {
    setActiveTab("data");
    requestAnimationFrame(() => {
      document
        .querySelector('[data-testid="key-vault-section"]')
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  };

  // #1765 — the providers overview "Import" action lands on the IMPORT block
  // of the same key-vault section (not just the section top).
  const openKeyImport = () => {
    setActiveTab("data");
    requestAnimationFrame(() => {
      document
        .querySelector('[data-testid="key-vault-import"]')
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const userId = readLearnerState().userId;
    if (!userId) {
      navigate("/onboarding", { replace: true });
      return;
    }
    let cancelled = false;
    const loadSettings = () => {
      getStorage()
        .settings.get(userId)
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
    };
    loadSettings();
    // #1765 — re-read settings when a section mutates them out-of-band (an
    // encrypted key-vault import, a backup restore) so the AI tab reflects an
    // imported key immediately, without a manual reload.
    const unsubscribe = subscribeSettingsRefresh(loadSettings);
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

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
          <GeneralPanel
            settings={settings}
            onSettingsChange={setSettings}
            active={activeTab === "general"}
          />

          <AiSettingsPanel
            settings={settings}
            onSettingsChange={setSettings}
            active={activeTab === "ai"}
            onOpenKeyExport={openKeyExport}
            onOpenKeyImport={openKeyImport}
          />

          <LearningPanel active={activeTab === "learning"} />
          <PluginsPanel active={activeTab === "plugins"} />
          <DataPanel active={activeTab === "data"} />
          <IntegrationsPanel active={activeTab === "integrations"} />
          <HelpPanel active={activeTab === "help"} />
          <AboutPanel active={activeTab === "about"} />
        </div>
      </div>
    </main>
  );
}
