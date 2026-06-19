/**
 * One provider's API-key row for the Settings AI tab (extracted from
 * AiSettingsPanel for the complexity burn-down #425).
 *
 * Owns the save / live-test / delete controls, the format-validation
 * feedback, and the auto-test-on-save rollback prompt for a single
 * provider. State + handlers stay in ``useAiKeySettings``; this file is
 * presentation only. Split into ``ApiKeyRow`` + ``ApiKeyActions`` +
 * ``ApiKeyFeedback`` so each function stays within the complexity gate.
 */

import { FlaskConical, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../hooks/useI18n";
import { SecretInput } from "../shared/SecretInput";
import { API_KEY_FORMAT_HINT, isValidApiKeyFormat } from "../lib/apiKeyFormat";
import type { AIProvider } from "../lib/constants";
import type { ApiKeySource, UserSettings } from "../types/domain";
import type { ApiKeyTestKind, ApiKeyTestResult } from "../storage/types";

type Translate = (key: string, fallback?: string) => string;
type FormatState = "empty" | "valid" | "invalid";

/** ``empty`` (nothing typed) / ``valid`` / ``invalid`` for the draft. */
function formatStateFor(provider: AIProvider, draft: string): FormatState {
  if (draft.trim().length === 0) return "empty";
  return isValidApiKeyFormat(provider, draft) ? "valid" : "invalid";
}

/** Localized "Key from: …" label for the resolved key source. */
function keySourceLabel(source: ApiKeySource, t: Translate): string {
  if (source === "secrets_yaml")
    return t("settings.api_key_source_file", "Key from: secrets.yaml");
  if (source === "env")
    return t("settings.api_key_source_env", "Key from: environment");
  if (source === "settings")
    return t("settings.api_key_source_settings", "Key from: Settings");
  return t("settings.api_key_source_none", "No key configured");
}

/** CSS modifier for a test-result message by outcome kind. */
function testResultClass(kind: ApiKeyTestKind): string {
  if (kind === "ok") return "is-ok";
  if (kind === "invalid") return "is-invalid";
  return "is-warning";
}

/** Localized, icon-prefixed message for a test-result outcome kind. */
function testResultMessage(kind: ApiKeyTestKind, t: Translate): string {
  if (kind === "ok") return `✓ ${t("settings.api_key.test_success", "Key works!")}`;
  if (kind === "invalid")
    return `✗ ${t("settings.api_key.test_invalid", "Key invalid or expired.")}`;
  if (kind === "rate_limit")
    return `⚠ ${t("settings.api_key.test_rate_limit", "Rate limit hit. Try later.")}`;
  if (kind === "no_key")
    return `⚠ ${t("settings.api_key.test_no_key", "No key to test.")}`;
  return `⚠ ${t(
    "settings.api_key.test_network",
    "Connection failed. Check your internet connection.",
  )}`;
}

interface ApiKeyRowProps {
  provider: AIProvider;
  settings: UserSettings;
  draft: string;
  busy: string | null;
  testResult: ApiKeyTestResult | null;
  rollbackActive: boolean;
  backupAvailable: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onTest: () => void;
  onDelete: () => void;
  onKeepOld: () => void;
  onSaveAnyway: () => void;
  onDismissRollback: () => void;
  onRestoreBackup: () => void;
}

/** A single provider's API-key form (status, input, actions, feedback). */
export default function ApiKeyRow({
  provider,
  settings,
  draft,
  busy,
  testResult,
  rollbackActive,
  backupAvailable,
  onDraftChange,
  onSave,
  onTest,
  onDelete,
  onKeepOld,
  onSaveAnyway,
  onDismissRollback,
  onRestoreBackup,
}: ApiKeyRowProps) {
  const { t } = useI18n();
  const has = settings[`has_${provider}_key`] as boolean;
  const isActive = settings.active_provider === provider;
  // Only an env-var-sourced key is truly read-only from the UI: the user
  // must change the environment, not the app. A ``secrets.yaml`` key IS
  // editable now that the app writes to that file. ``settings`` (DB) and
  // ``none`` were always editable.
  const source = settings[`key_source_${provider}`];
  const externallyManaged = source === "env";
  const fromSecretsFile = source === "secrets_yaml";
  const formatState = formatStateFor(provider, draft);

  return (
    <div
      className={`api-key-row${isActive ? " is-active-provider" : ""}`}
      data-testid={`api-key-row-${provider}`}
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
          {keySourceLabel(source, t)}
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
          <SecretInput
            data-testid={`api-key-input-${provider}`}
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
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
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
        <ApiKeyActions
          provider={provider}
          busy={busy}
          has={has}
          formatState={formatState}
          externallyManaged={externallyManaged}
          onSave={onSave}
          onTest={onTest}
          onDelete={onDelete}
        />
      </div>
      <ApiKeyFeedback
        provider={provider}
        busy={busy}
        testResult={testResult}
        formatState={formatState}
        rollbackActive={rollbackActive}
        backupAvailable={backupAvailable}
        onKeepOld={onKeepOld}
        onSaveAnyway={onSaveAnyway}
        onDismissRollback={onDismissRollback}
        onRestoreBackup={onRestoreBackup}
      />
    </div>
  );
}

interface ApiKeyActionsProps {
  provider: AIProvider;
  busy: string | null;
  has: boolean;
  formatState: FormatState;
  externallyManaged: boolean;
  onSave: () => void;
  onTest: () => void;
  onDelete: () => void;
}

/** Save / Test / Delete buttons for one provider. */
function ApiKeyActions({
  provider,
  busy,
  has,
  formatState,
  externallyManaged,
  onSave,
  onTest,
  onDelete,
}: ApiKeyActionsProps) {
  const { t } = useI18n();
  const testing = busy === `test-${provider}`;
  const testLabel = testing
    ? t("settings.api_key.testing", "Testing…")
    : t("settings.api_key.test", "Test");

  return (
    <>
      <Button
        type="button"
        data-testid={`api-key-save-${provider}`}
        onClick={onSave}
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
          onClick={onTest}
          disabled={testing}
          aria-label={testLabel}
          title={testLabel}
        >
          {testing ? (
            <span className="btn-spinner" aria-hidden="true" />
          ) : (
            <FlaskConical className="h-5 w-5" aria-hidden="true" />
          )}
          <span className="hidden md:inline">{testLabel}</span>
        </Button>
      )}
      {has && !externallyManaged && (
        <Button
          type="button"
          variant="destructive"
          data-testid={`api-key-delete-${provider}`}
          onClick={onDelete}
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
    </>
  );
}

interface ApiKeyFeedbackProps {
  provider: AIProvider;
  busy: string | null;
  testResult: ApiKeyTestResult | null;
  formatState: FormatState;
  rollbackActive: boolean;
  backupAvailable: boolean;
  onKeepOld: () => void;
  onSaveAnyway: () => void;
  onDismissRollback: () => void;
  onRestoreBackup: () => void;
}

/** Test-result message, format error, and the rollback prompt. */
function ApiKeyFeedback({
  provider,
  busy,
  testResult,
  formatState,
  rollbackActive,
  backupAvailable,
  onKeepOld,
  onSaveAnyway,
  onDismissRollback,
  onRestoreBackup,
}: ApiKeyFeedbackProps) {
  const { t } = useI18n();
  const showStandaloneRestore =
    backupAvailable && !rollbackActive && testResult !== null && !testResult.success;

  return (
    <>
      {testResult && (
        <p
          className={`api-key-test-result ${testResultClass(testResult.kind)}`}
          data-testid={`api-key-test-result-${provider}`}
          role="status"
        >
          {testResultMessage(testResult.kind, t)}
        </p>
      )}
      {formatState === "invalid" && (
        <p className="api-key-format-error" data-testid={`api-key-format-error-${provider}`}>
          {t("settings.api_key.format_invalid", "Invalid format.")}{" "}
          {t(
            `settings.api_key.format_hint.${provider}`,
            API_KEY_FORMAT_HINT[provider],
          )}
        </p>
      )}
      {rollbackActive && (
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
              onClick={onKeepOld}
            >
              {t("settings.api_key.rollback_keep_old", "Keep old key")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-testid={`api-key-rollback-save-anyway-${provider}`}
              onClick={onSaveAnyway}
              disabled={busy === `save-${provider}`}
            >
              {t("settings.api_key.rollback_save_anyway", "Save anyway")}
            </Button>
            <Button
              type="button"
              variant="link"
              data-testid={`api-key-rollback-cancel-${provider}`}
              onClick={onDismissRollback}
            >
              {t("settings.api_key.rollback_cancel", "Cancel")}
            </Button>
            {backupAvailable && (
              <Button
                type="button"
                variant="link"
                data-testid={`api-key-restore-${provider}`}
                onClick={onRestoreBackup}
                disabled={busy === `restore-${provider}`}
              >
                {t("settings.api_key.rollback_restore", "Restore last working key")}
              </Button>
            )}
          </div>
        </div>
      )}
      {showStandaloneRestore && (
        <Button
          type="button"
          variant="link"
          className="api-key-restore-link"
          data-testid={`api-key-restore-link-${provider}`}
          onClick={onRestoreBackup}
          disabled={busy === `restore-${provider}`}
        >
          {t("settings.api_key.rollback_restore", "Restore last working key")}
        </Button>
      )}
    </>
  );
}
