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

import { Button } from "@/components/ui/button";
import { ModelPicker } from "./ModelPicker";
import ApiKeyRow from "./ApiKeyRow";
import { useI18n } from "../hooks/useI18n";
import { useAiKeySettings } from "../hooks/useAiKeySettings";
import { DEFAULT_MODELS } from "../storage/ai-providers";
import {
  AI_PROVIDERS,
  MODEL_SUGGESTIONS,
  type AIProvider,
} from "../lib/constants";
import type { UserSettings } from "../types";

interface AiSettingsPanelProps {
  /** The loaded user settings (the AI tab only renders once present). */
  settings: UserSettings;
  /** Commit updated settings back to the Settings page. */
  onSettingsChange: (next: UserSettings) => void;
  /** Whether the AI tab is the active tab (drives ``hidden``). */
  active: boolean;
}

/** Provider / model-override / API-key sections of the Settings AI tab. */
export default function AiSettingsPanel({
  settings,
  onSettingsChange,
  active,
}: AiSettingsPanelProps) {
  const { t } = useI18n();
  const {
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
  } = useAiKeySettings(settings, onSettingsChange);

  return (
    <>
      <section className="settings-section" hidden={!active}>
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
        hidden={!active}
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

      <section className="settings-section" hidden={!active}>
        <h2 className="settings-section-title">{t("settings.section_api_keys", "API keys")}</h2>
        {AI_PROVIDERS.map((provider) => (
          <ApiKeyRow
            key={provider}
            provider={provider}
            settings={settings}
            draft={keyDrafts[provider]}
            busy={busy}
            testResult={testResults[provider]}
            rollbackActive={rollbackPrompt?.provider === provider}
            backupAvailable={backupAvailable[provider]}
            onDraftChange={(value) =>
              setKeyDrafts((prev) => ({ ...prev, [provider]: value }))
            }
            onSave={() => handleSaveKey(provider)}
            onTest={() => handleTestKey(provider)}
            onDelete={() => handleDeleteKey(provider)}
            onKeepOld={() => handleKeepOldKey(provider)}
            onSaveAnyway={() => handleSaveAnyway(provider)}
            onDismissRollback={handleDismissRollback}
            onRestoreBackup={() => handleRestoreBackup(provider)}
          />
        ))}
      </section>
    </>
  );
}
