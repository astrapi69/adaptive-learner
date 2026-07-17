/**
 * AI tab of the Settings page: active-provider select, per-provider
 * model overrides, and the API-key manager (save / live-test / delete,
 * with the auto-test-on-save rollback flow).
 *
 * All state + handlers live in {@link useAiKeySettings}; this component
 * is the presentation layer. Every section stays mounted and is shown
 * via the ``hidden`` attribute (matching the page's tab pattern) so deep
 * links and data-testid assertions keep working.
 */

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { ModelPicker } from "./ModelPicker";
import ApiKeyRow from "./ApiKeyRow";
import ConfiguredProvidersTable from "./ConfiguredProvidersTable";
import { useI18n } from "../../../hooks/ui/useI18n";
import { useAiKeySettings } from "../../../hooks/settings/useAiKeySettings";
import { DEFAULT_MODELS } from "../../../storage/ai/ai-providers";
import { resolveStorageMode } from "../../../storage";
import {
  AI_PROVIDERS,
  MODEL_SUGGESTIONS,
  type AIProvider,
} from "../../../lib/constants";
import type { UserSettings } from "../../../types";

/**
 * Scroll a provider's key input into view and focus it. Used by the
 * overview table's Edit / Add actions. Guards ``scrollIntoView`` / ``focus``
 * so it is a no-op under happy-dom.
 */
function focusProviderInput(provider: AIProvider): void {
  const el = document.querySelector<HTMLInputElement>(
    `[data-testid="api-key-input-${provider}"]`,
  );
  el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  el?.focus?.();
}

interface AiSettingsPanelProps {
  /** The loaded user settings (the AI tab only renders once present). */
  settings: UserSettings;
  /** Commit updated settings back to the Settings page. */
  onSettingsChange: (next: UserSettings) => void;
  /** Whether the AI tab is the active tab (drives ``hidden``). */
  active: boolean;
  /**
   * Navigate to the encrypted key export/import, which lives on the Data
   * tab next to the other backups (#1183). The AI tab only links there —
   * the single export entry point stays on the Data tab.
   */
  onOpenKeyExport: () => void;
  /**
   * Navigate to the encrypted key IMPORT sub-section on the Data tab (#1765).
   * Same destination as {@link onOpenKeyExport} but scrolls to the Import
   * block so the "Import" action in the providers overview lands on it.
   */
  onOpenKeyImport: () => void;
}

/** Provider / model-override / API-key sections of the Settings AI tab. */
export default function AiSettingsPanel({
  settings,
  onSettingsChange,
  active,
  onOpenKeyExport,
  onOpenKeyImport,
}: AiSettingsPanelProps) {
  const { t } = useI18n();
  const mode = resolveStorageMode();
  const overviewRef = useRef<HTMLDivElement>(null);
  const {
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
  } = useAiKeySettings(settings, onSettingsChange);

  // #810 — after a save the key field clears; bring the user back to the
  // overview where the freshly-stored key now shows (masked).
  const handleSaveKeyAndReturn = async (provider: AIProvider) => {
    await handleSaveKey(provider);
    overviewRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="settings-tabpanel"
      role="tabpanel"
      hidden={!active}
      data-testid="settings-panel-ai"
    >
      <div ref={overviewRef}>
        <ConfiguredProvidersTable
          settings={settings}
          mode={mode}
          busy={busy}
          testResults={testResults}
          onSetActive={handleProviderChange}
          onEdit={focusProviderInput}
          onDelete={handleDeleteKey}
          onTest={handleTestKey}
          onImportKeys={onOpenKeyImport}
        />
      </div>

      <section className="settings-section">
        <h2 className="settings-section-title">{t("settings.section_provider", "AI provider")}</h2>
        <label className="form-row">
          <span className="form-label">{t("settings.provider_label", "Active provider")}</span>
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
                  hasApiKey={(settings[`has_${provider}_key`] as boolean) ?? false}
                />
                <Button
                  type="button"
                  data-testid={`model-override-save-${provider}`}
                  onClick={() => handleSaveModel(provider)}
                  disabled={busy === `save-model-${provider}` || !dirty}
                >
                  {t("settings.model_override_save", "Save model")}
                </Button>
                {current && (
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid={`model-override-clear-${provider}`}
                    onClick={() => handleClearModel(provider)}
                    disabled={busy === `clear-model-${provider}`}
                  >
                    {t("settings.model_override_clear", "Use default")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">{t("settings.section_api_keys", "API keys")}</h2>
        {AI_PROVIDERS.map((provider) => (
          <ApiKeyRow
            key={provider}
            provider={provider}
            settings={settings}
            draft={keyDrafts[provider]}
            busy={busy}
            testResult={testResults[provider]}
            backupAvailable={backupAvailable[provider]}
            onDraftChange={(value) =>
              setKeyDrafts((prev) => ({ ...prev, [provider]: value }))
            }
            onSave={() => handleSaveKeyAndReturn(provider)}
            onTest={() => handleTestKey(provider)}
            onDelete={() => handleDeleteKey(provider)}
            onRestoreBackup={() => handleRestoreBackup(provider)}
          />
        ))}
      </section>

      {/* Discoverability bridge (#1183): the encrypted key export/import
          (EXP-038, .alk) lives on the Data tab next to the other backups —
          a single export entry point. This is only a link there, never a
          second export form. */}
      <section className="settings-section">
        <h2 className="settings-section-title">
          {t("settings.key_export_link.heading", "AI keys — encrypted export")}
        </h2>
        <p className="muted">
          {t(
            "settings.key_export_link.hint",
            "Export or import your AI keys as a single encrypted file. It lives with the other backups in the Data tab.",
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onOpenKeyExport}
          data-testid="ai-key-export-link"
        >
          {t("settings.key_export_link.button", "Go to key export (Data tab)")}
        </Button>
      </section>
    </div>
  );
}
