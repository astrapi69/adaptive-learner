/**
 * Settings AI-tab overview of every configured AI provider (#810).
 *
 * Renders one row per provider with its model, key status, masked key
 * preview, an "active provider" radio, and Edit / Add / Delete actions —
 * so a returning user instantly sees WHICH providers have a key stored,
 * instead of facing an empty key field with no confirmation.
 *
 * Presentation only: all state + handlers come from props (the AI panel
 * owns them, backed by ``useAiKeySettings``). Works in both storage modes
 * — the masked preview is supplied on the settings payload
 * (``key_preview_<provider>``), computed server-side in API mode and
 * client-side in Dexie mode.
 */

import { Bot, FlaskConical, Gem, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../hooks/ui/useI18n";
import { AI_PROVIDERS, type AIProvider } from "../lib/constants";
import {
  isDesktopOnlyProvider,
  providerKeyStatus,
  type ProviderKeyStatus,
} from "../lib/aiProviderStatus";
import { DEFAULT_MODELS } from "../storage/ai/ai-providers";
import type { ApiKeyTestResult, StorageMode } from "../storage/types";
import type { UserSettings } from "../types/domain";

type Translate = (key: string, fallback?: string) => string;

/** Decorative per-provider glyph (aria-hidden; the name carries meaning). */
const PROVIDER_ICON: Record<AIProvider, ComponentType<{ className?: string }>> = {
  anthropic: Sparkles,
  openai: Bot,
  gemini: Gem,
};

/** Tailwind text-colour utility (token-backed) per status. */
const STATUS_CLASS: Record<ProviderKeyStatus, string> = {
  active: "text-success",
  empty: "text-fg-muted",
  desktop_only: "text-warning",
  external: "text-info",
};

/** Localized status label. */
function statusLabel(status: ProviderKeyStatus, t: Translate): string {
  if (status === "active") return t("settings.providers.status_active", "Active");
  if (status === "desktop_only")
    return t("settings.providers.status_desktop_only", "Desktop only");
  if (status === "external") return t("settings.providers.status_external", "External");
  return t("settings.providers.status_empty", "Empty");
}

/** How long a successful "Connection ok" message stays on screen (ms). */
const TEST_OK_VISIBLE_MS = 10_000;

interface TestDisplay {
  tone: "ok" | "error";
  text: string;
}

/** Map a live-test outcome to an inline {tone, text} for the row, or null
 *  when there is nothing to show. Reuses the existing ``settings.api_key.*``
 *  messages for the rarer kinds so no catalog gap opens. */
function testDisplay(result: ApiKeyTestResult | null, t: Translate): TestDisplay | null {
  if (!result) return null;
  if (result.success)
    return { tone: "ok", text: t("settings.providers.test_connection_ok", "Connection ok") };
  if (result.kind === "invalid")
    return { tone: "error", text: t("settings.providers.test_key_invalid", "Key invalid") };
  if (result.kind === "network")
    return { tone: "error", text: t("settings.providers.test_network_error", "Network error") };
  if (result.kind === "rate_limit")
    return {
      tone: "error",
      text: t("settings.api_key.test_rate_limit", "Rate limit hit. Try later."),
    };
  if (result.kind === "no_key")
    return { tone: "error", text: t("settings.api_key.test_no_key", "No key to test.") };
  return {
    tone: "error",
    text: t("settings.api_key.test_error", "Test failed. The provider rejected the request."),
  };
}

interface ProviderTestResultProps {
  provider: AIProvider;
  result: ApiKeyTestResult | null;
}

/** Inline live-test result for one row. A success auto-hides after
 *  ~10s; an error stays until the next test. */
function ProviderTestResult({ provider, result }: ProviderTestResultProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    if (result?.success) {
      const timer = setTimeout(() => setVisible(false), TEST_OK_VISIBLE_MS);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const display = testDisplay(result, t);
  if (!display || !visible) return null;
  return (
    <span
      className={`configured-provider-test-result ${
        display.tone === "ok" ? "text-success" : "text-error"
      }`}
      data-testid={`provider-overview-test-result-${provider}`}
      role="status"
    >
      {display.tone === "ok" ? "✓ " : "✗ "}
      {display.text}
    </span>
  );
}

interface ProviderRow {
  provider: AIProvider;
  status: ProviderKeyStatus;
  hasKey: boolean;
  isActive: boolean;
  model: string | null;
  preview: string | null;
}

/** Derive the display row for one provider from the settings payload. */
function buildRow(
  provider: AIProvider,
  settings: UserSettings,
  mode: StorageMode,
): ProviderRow {
  const hasKey = settings[`has_${provider}_key`] as boolean;
  const source = settings[`key_source_${provider}`];
  const status = providerKeyStatus({
    hasKey,
    source,
    mode,
    corsBlocked: isDesktopOnlyProvider(provider),
  });
  const override = (settings[`model_override_${provider}`] as string | null) ?? "";
  const model = hasKey ? override.trim() || DEFAULT_MODELS[provider] : null;
  const preview = (settings[`key_preview_${provider}`] as string | null | undefined) ?? null;
  return { provider, status, hasKey, isActive: settings.active_provider === provider, model, preview };
}

interface ConfiguredProvidersTableProps {
  /** The loaded user settings. */
  settings: UserSettings;
  /** Active storage mode (drives the desktop-only status). */
  mode: StorageMode;
  /** Disables the row controls while a write is in flight. */
  busy: string | null;
  /** Last live-test outcome per provider (``null`` = not tested). */
  testResults: Record<AIProvider, ApiKeyTestResult | null>;
  /** Make this provider the active one for AI calls. */
  onSetActive: (provider: AIProvider) => void;
  /** Jump to (and focus) this provider's key form. */
  onEdit: (provider: AIProvider) => void;
  /** Remove this provider's stored key. */
  onDelete: (provider: AIProvider) => void;
  /** Live-test this provider's stored key. */
  onTest: (provider: AIProvider) => void;
}

/** At-a-glance table of configured AI providers + their key status. */
export default function ConfiguredProvidersTable({
  settings,
  mode,
  busy,
  testResults,
  onSetActive,
  onEdit,
  onDelete,
  onTest,
}: ConfiguredProvidersTableProps) {
  const { t } = useI18n();
  const rows = AI_PROVIDERS.map((provider) => buildRow(provider, settings, mode));

  return (
    <section className="settings-section" data-testid="configured-providers">
      <h2 className="settings-section-title">
        {t("settings.providers.title", "Configured AI providers")}
      </h2>
      <p className="muted">
        {t(
          "settings.providers.hint",
          "Keys you have saved stay stored. Only a masked preview is shown — never the full key.",
        )}
      </p>
      <ul className="configured-providers-list" role="list">
        {rows.map((row) => (
          <ProviderOverviewRow
            key={row.provider}
            row={row}
            busy={busy}
            testResult={testResults[row.provider]}
            onSetActive={onSetActive}
            onEdit={onEdit}
            onDelete={onDelete}
            onTest={onTest}
          />
        ))}
      </ul>
    </section>
  );
}

interface ProviderOverviewRowProps {
  row: ProviderRow;
  busy: string | null;
  testResult: ApiKeyTestResult | null;
  onSetActive: (provider: AIProvider) => void;
  onEdit: (provider: AIProvider) => void;
  onDelete: (provider: AIProvider) => void;
  onTest: (provider: AIProvider) => void;
}

/** One provider's overview row. */
function ProviderOverviewRow({
  row,
  busy,
  testResult,
  onSetActive,
  onEdit,
  onDelete,
  onTest,
}: ProviderOverviewRowProps) {
  const { t } = useI18n();
  const { provider, status, hasKey, isActive, model, preview } = row;
  const Icon = PROVIDER_ICON[provider];
  const name = t(`settings.provider_${provider}`, provider);
  const testing = busy === `test-${provider}`;
  // A CORS-blocked provider in Dexie (browser) mode can only be tested
  // through the backend, so the button is disabled with an explainer.
  const backendOnly = status === "desktop_only";
  const testLabel = testing
    ? t("settings.providers.testing", "Testing…")
    : t("settings.providers.test", "Test");

  return (
    <li
      className={`configured-provider-row${isActive ? " is-active-provider" : ""}`}
      data-testid={`provider-overview-row-${provider}`}
    >
      <label className="configured-provider-active">
        <input
          type="radio"
          name="active-ai-provider"
          checked={isActive}
          disabled={busy === "provider"}
          onChange={() => onSetActive(provider)}
          aria-label={t("settings.providers.set_active", "Use as active provider")}
          data-testid={`provider-overview-active-${provider}`}
        />
      </label>

      <span className="configured-provider-name">
        <Icon className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
        <strong>{name}</strong>
        {isActive && (
          <span className="api-key-active-badge" data-testid={`provider-overview-badge-${provider}`}>
            {t("settings.provider_active", "Active")}
          </span>
        )}
      </span>

      <span
        className="configured-provider-model font-mono text-fg-secondary"
        data-testid={`provider-overview-model-${provider}`}
      >
        {model ?? "—"}
      </span>

      <span
        className={`configured-provider-status ${STATUS_CLASS[status]}`}
        data-testid={`provider-overview-status-${provider}`}
      >
        {statusLabel(status, t)}
      </span>

      <span
        className="configured-provider-preview font-mono text-fg-muted"
        data-testid={`provider-overview-preview-${provider}`}
      >
        {preview ?? "—"}
      </span>

      <span className="configured-provider-actions">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onEdit(provider)}
          data-testid={`provider-overview-edit-${provider}`}
          aria-label={
            hasKey
              ? `${t("settings.providers.edit", "Edit")} (${name})`
              : `${t("settings.providers.add", "Add key")} (${name})`
          }
          title={hasKey ? t("settings.providers.edit", "Edit") : t("settings.providers.add", "Add key")}
        >
          {hasKey ? (
            <Pencil className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden md:inline">
            {hasKey ? t("settings.providers.edit", "Edit") : t("settings.providers.add", "Add key")}
          </span>
        </Button>
        {hasKey && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onTest(provider)}
            disabled={testing || backendOnly}
            data-testid={`provider-overview-test-${provider}`}
            aria-label={
              backendOnly
                ? t("settings.providers.test_backend_only", "Only testable with the backend")
                : `${testLabel} (${name})`
            }
            title={
              backendOnly
                ? t("settings.providers.test_backend_only", "Only testable with the backend")
                : testLabel
            }
          >
            {testing ? (
              <span className="btn-spinner" aria-hidden="true" />
            ) : (
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden md:inline">{testLabel}</span>
          </Button>
        )}
        {hasKey && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onDelete(provider)}
            disabled={busy === `delete-${provider}`}
            data-testid={`provider-overview-delete-${provider}`}
            aria-label={`${t("settings.api_key_delete", "Remove key")} (${name})`}
            title={t("settings.api_key_delete", "Remove key")}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">{t("settings.api_key_delete", "Remove key")}</span>
          </Button>
        )}
      </span>

      <ProviderTestResult provider={provider} result={testResult} />
    </li>
  );
}
