/**
 * GitHub Integration settings (community PR automation).
 *
 * Stores a GitHub Personal Access Token (``repo`` scope) so "Share with
 * Community" can create the pull request PROGRAMMATICALLY — fork the
 * content repo, commit the lesson file, open the PR — instead of the
 * old pre-filled-URL approach that frequently left users with an empty
 * PR. Same shape as the AI-key fields:
 *
 *   - a token input with instant format validation (``ghp_…`` /
 *     ``github_pat_…``; Save gated on a plausible token)
 *   - a Test button (verifies via ``GET /user`` and shows the username)
 *   - a source line ("Stored in secrets.yaml" / "environment" /
 *     "browser") + a Remove button when configured
 *
 * Works in both storage modes via ``getStorage().github`` — ApiStorage
 * keeps the token server-side (secrets.yaml); DexieStorage holds it in
 * the browser (localStorage). An env-managed token (``source ===
 * "environment"``) disables the input.
 */

import { useEffect, useState } from "react";
import { FlaskConical, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "../api/client";
import { useI18n } from "../hooks/useI18n";
import { SecretInput } from "../shared/SecretInput";
import { isValidGitHubTokenFormat } from "../lib/github/github-api";
import { getStorage } from "../storage";
import type { GitHubTokenStatus, GitHubVerifyKind } from "../storage/types";
import { notify } from "../utils/notify";

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; username: string | null }
  | { kind: "fail"; reason: GitHubVerifyKind };

const TOKEN_DOCS_URL = "https://github.com/settings/tokens";

export default function GitHubIntegrationSection() {
  const { t } = useI18n();
  const [status, setStatus] = useState<GitHubTokenStatus | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    getStorage()
      .github.getStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus({ configured: false, source: "none" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // An env-managed token can't be edited from the UI (same rule as the
  // externally-managed AI keys).
  const envManaged = status?.source === "environment";
  const formatValid = isValidGitHubTokenFormat(token);
  const trimmed = token.trim();

  function sourceLabel(source: string): string {
    if (source === "secrets.yaml")
      return t("settings.github.source_file", "Stored in secrets.yaml");
    if (source === "environment")
      return t("settings.github.source_env", "Managed via environment");
    if (source === "browser")
      return t("settings.github.source_browser", "Stored in this browser");
    return "";
  }

  async function handleSave() {
    if (!formatValid || saving) return;
    setSaving(true);
    try {
      const next = await getStorage().github.setToken(trimmed);
      setStatus(next);
      setToken("");
      setTest({ kind: "idle" });
      notify.success(t("settings.github.saved", "GitHub token saved."));
    } catch (error) {
      notify.error(
        error instanceof ApiError
          ? error.detail
          : t("ui.errors.unexpected", "Something went wrong."),
        error instanceof ApiError ? { apiError: error } : undefined,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTest({ kind: "testing" });
    try {
      // Test the typed token when present, else the configured one.
      const result = await getStorage().github.verifyToken(
        trimmed.length > 0 ? trimmed : undefined,
      );
      if (result.valid) {
        setTest({ kind: "ok", username: result.username });
      } else {
        setTest({ kind: "fail", reason: result.kind });
      }
    } catch {
      setTest({ kind: "fail", reason: "error" });
    }
  }

  async function handleClear() {
    setSaving(true);
    try {
      const next = await getStorage().github.clearToken();
      setStatus(next);
      setToken("");
      setTest({ kind: "idle" });
      notify.success(t("settings.github.removed", "GitHub token removed."));
    } catch (error) {
      notify.error(
        error instanceof ApiError
          ? error.detail
          : t("ui.errors.unexpected", "Something went wrong."),
        error instanceof ApiError ? { apiError: error } : undefined,
      );
    } finally {
      setSaving(false);
    }
  }

  function testMessage(state: TestState): string {
    if (state.kind === "ok") {
      return t("settings.github.test_success", "Connected as {username}").replace(
        "{username}",
        state.username ?? "?",
      );
    }
    if (state.kind === "fail") {
      if (state.reason === "rate_limit")
        return t("settings.github.test_rate_limit", "GitHub rate limit reached. Try again later.");
      if (state.reason === "network")
        return t("settings.github.test_network", "Could not reach GitHub.");
      if (state.reason === "no_token")
        return t("settings.github.test_no_token", "No token to test.");
      return t("settings.github.test_invalid", "Token invalid.");
    }
    return "";
  }

  // Test is allowed when there's a plausible typed token OR a configured
  // one already (so the user can re-check a saved token).
  const canTest =
    test.kind !== "testing" &&
    (formatValid || (status?.configured === true && trimmed.length === 0));

  return (
    <section
      className="settings-section"
      data-testid="settings-github"
      style={{ marginTop: "1.5rem" }}
    >
      <h2 className="settings-section-title">
        {t("settings.github.title", "GitHub Integration")}
      </h2>
      <p className="muted">
        {t(
          "settings.github.intro",
          "Needed to share lessons as a pull request. Create a token with 'repo' permission.",
        )}{" "}
        <a href={TOKEN_DOCS_URL} target="_blank" rel="noopener noreferrer">
          {TOKEN_DOCS_URL.replace("https://", "")}
        </a>
      </p>

      {status?.configured && (
        <p className="muted" data-testid="settings-github-source">
          {sourceLabel(status.source)}
        </p>
      )}

      {!envManaged && (
        <div>
          <label className="form-row">
            <span className="form-label">
              {t("settings.github.token", "GitHub token")}
            </span>
            <SecretInput
              value={token}
              placeholder="ghp_… / github_pat_…"
              aria-label={t("settings.github.token", "GitHub token")}
              onChange={(e) => {
                setToken(e.target.value);
                setTest({ kind: "idle" });
              }}
              data-testid="settings-github-token-input"
            />
          </label>
          {trimmed.length > 0 && !formatValid && (
            <p
              className="form-hint form-hint-warning"
              data-testid="settings-github-format-warning"
            >
              {t(
                "settings.github.format_invalid",
                "A GitHub token starts with 'ghp_' or 'github_pat_'.",
              )}
            </p>
          )}

          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={handleTest}
              disabled={!canTest}
              data-testid="settings-github-test"
              aria-label={
                test.kind === "testing"
                  ? t("settings.github.testing", "Testing…")
                  : t("settings.github.test", "Test")
              }
              title={
                test.kind === "testing"
                  ? t("settings.github.testing", "Testing…")
                  : t("settings.github.test", "Test")
              }
            >
              <FlaskConical className="h-5 w-5" aria-hidden="true" />
              <span className="hidden md:inline">
                {test.kind === "testing"
                  ? t("settings.github.testing", "Testing…")
                  : t("settings.github.test", "Test")}
              </span>
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSave}
              disabled={!formatValid || saving}
              data-testid="settings-github-save"
              aria-label={t("settings.github.save", "Save")}
              title={t("settings.github.save", "Save")}
            >
              <Save className="h-5 w-5" aria-hidden="true" />
              <span className="hidden md:inline">
                {t("settings.github.save", "Save")}
              </span>
            </Button>
            {status?.configured && (
              <Button
                type="button"
                variant="link"
                onClick={handleClear}
                disabled={saving}
                data-testid="settings-github-clear"
                aria-label={t("settings.github.remove", "Remove")}
                title={t("settings.github.remove", "Remove")}
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
                <span className="hidden md:inline">
                  {t("settings.github.remove", "Remove")}
                </span>
              </Button>
            )}
          </div>

          {test.kind === "ok" && (
            <p
              className="content-share-passed"
              data-testid="settings-github-test-result"
            >
              {testMessage(test)}
            </p>
          )}
          {test.kind === "fail" && (
            <p
              className="content-share-failed"
              data-testid="settings-github-test-result"
              role="alert"
            >
              {testMessage(test)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
