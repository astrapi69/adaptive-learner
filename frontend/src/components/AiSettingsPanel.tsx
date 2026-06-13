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

import { FlaskConical, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModelPicker } from "./ModelPicker";
import { useI18n } from "../hooks/useI18n";
import { useAiKeySettings } from "../hooks/useAiKeySettings";
import { DEFAULT_MODELS } from "../storage/ai-providers";
import {
  AI_PROVIDERS,
  MODEL_SUGGESTIONS,
  type AIProvider,
} from "../lib/constants";
import { API_KEY_PREFIX, isValidApiKeyFormat } from "../lib/apiKeyFormat";
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
            <form
              key={provider}
              className={`api-key-row${isActive ? " is-active-provider" : ""}`}
              data-testid={`api-key-row-${provider}`}
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="api-key-row-head">
                <strong>{t(`settings.provider_${provider}`, provider)}</strong>
                {isActive && (
                  <span className="api-key-active-badge" data-testid={`api-key-active-${provider}`}>
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
                    ? t("settings.api_key_source_file", "Key from: secrets.yaml")
                    : source === "env"
                      ? t("settings.api_key_source_env", "Key from: environment")
                      : source === "settings"
                        ? t("settings.api_key_source_settings", "Key from: Settings")
                        : t("settings.api_key_source_none", "No key configured")}
                </span>
              </div>
              {externallyManaged && (
                <p className="api-key-external-hint" data-testid={`api-key-external-${provider}`}>
                  {t(
                    "settings.api_key_external_hint_env",
                    "This key is configured via the ADAPTIVE_LEARNER_{PROVIDER}_API_KEY environment variable.",
                  ).replace("{PROVIDER}", provider.toUpperCase())}
                </p>
              )}
              {fromSecretsFile && (
                <p className="api-key-source-file-hint" data-testid={`api-key-info-${provider}`}>
                  {t(
                    "settings.api_key_external_hint_file",
                    "Stored in ~/.config/adaptive_learner/secrets.yaml. Saving here overwrites it.",
                  )}
                </p>
              )}
              {isActive && !has && !externallyManaged && (
                <p className="api-key-warning" data-testid={`api-key-warning-${provider}`}>
                  {t(
                    "settings.active_provider_missing_key",
                    "This is your active provider but no API key is stored. AI replies will be skipped until a key is saved.",
                  )}
                </p>
              )}
              <div className="api-key-row-input">
                <span className={`api-key-input-wrap api-key-format-${formatState}`}>
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
                <Button
                  type="button"
                  data-testid={`api-key-save-${provider}`}
                  onClick={() => handleSaveKey(provider)}
                  disabled={
                    busy === `save-${provider}` || formatState !== "valid" || externallyManaged
                  }
                  aria-label={t("settings.api_key_set", "Save key")}
                  title={t("settings.api_key_set", "Save key")}
                >
                  <Save className="h-5 w-5" aria-hidden="true" />
                  <span className="hidden md:inline">{t("settings.api_key_set", "Save key")}</span>
                </Button>
                {(has || formatState === "valid") && (
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid={`api-key-test-${provider}`}
                    onClick={() => handleTestKey(provider)}
                    disabled={busy === `test-${provider}`}
                    aria-label={
                      busy === `test-${provider}`
                        ? t("settings.api_key.testing", "Testing…")
                        : t("settings.api_key.test", "Test")
                    }
                    title={
                      busy === `test-${provider}`
                        ? t("settings.api_key.testing", "Testing…")
                        : t("settings.api_key.test", "Test")
                    }
                  >
                    {busy === `test-${provider}` ? (
                      <span className="btn-spinner" aria-hidden="true" />
                    ) : (
                      <FlaskConical className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span className="hidden md:inline">
                      {busy === `test-${provider}`
                        ? t("settings.api_key.testing", "Testing…")
                        : t("settings.api_key.test", "Test")}
                    </span>
                  </Button>
                )}
                {has && !externallyManaged && (
                  <Button
                    type="button"
                    variant="destructive"
                    data-testid={`api-key-delete-${provider}`}
                    onClick={() => handleDeleteKey(provider)}
                    disabled={busy === `delete-${provider}`}
                    aria-label={t("settings.api_key_delete", "Remove key")}
                    title={t("settings.api_key_delete", "Remove key")}
                  >
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                    <span className="hidden md:inline">
                      {t("settings.api_key_delete", "Remove key")}
                    </span>
                  </Button>
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
                    <Button
                      type="button"
                      data-testid={`api-key-rollback-keep-${provider}`}
                      onClick={() => handleKeepOldKey(provider)}
                    >
                      {t("settings.api_key.rollback_keep_old", "Keep old key")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      data-testid={`api-key-rollback-save-anyway-${provider}`}
                      onClick={() => handleSaveAnyway(provider)}
                      disabled={busy === `save-${provider}`}
                    >
                      {t("settings.api_key.rollback_save_anyway", "Save anyway")}
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      data-testid={`api-key-rollback-cancel-${provider}`}
                      onClick={handleDismissRollback}
                    >
                      {t("settings.api_key.rollback_cancel", "Cancel")}
                    </Button>
                    {backupAvailable[provider] && (
                      <Button
                        type="button"
                        variant="link"
                        data-testid={`api-key-restore-${provider}`}
                        onClick={() => handleRestoreBackup(provider)}
                        disabled={busy === `restore-${provider}`}
                      >
                        {t("settings.api_key.rollback_restore", "Restore last working key")}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {backupAvailable[provider] &&
                rollbackPrompt?.provider !== provider &&
                testResults[provider] &&
                !testResults[provider]!.success && (
                  <Button
                    type="button"
                    variant="link"
                    className="api-key-restore-link"
                    data-testid={`api-key-restore-link-${provider}`}
                    onClick={() => handleRestoreBackup(provider)}
                    disabled={busy === `restore-${provider}`}
                  >
                    {t("settings.api_key.rollback_restore", "Restore last working key")}
                  </Button>
                )}
            </form>
          );
        })}
      </section>
    </>
  );
}
