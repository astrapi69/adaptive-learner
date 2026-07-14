/**
 * Register-your-repo section (federated content-repo search).
 *
 * The consumer-side counterpart to the content-repo's registry governance: a
 * learner who owns a content repo proposes it for the cross-repo search here.
 * The flow resolves the repo's CURRENT commit, runs the same technical
 * validation the add-repo flow uses, derives the advertised language pairs +
 * index schema version from the repo's ``search-index.json``, and builds the
 * exact ``recommended-repos.json`` entry the registry expects.
 *
 * Two ways to propose it (mode-agnostic primary + tokened convenience):
 *   1. ALWAYS: copy the ready JSON block + open the registry file's edit page
 *      to paste it and "Propose changes" (GitHub auto-forks). No token.
 *   2. Dexie mode + a configured GitHub token: "Create pull request" runs the
 *      programmatic fork -> commit -> PR flow directly.
 *
 * Pure logic (entry/JSON/PR body/upsert) lives in
 * ``lib/content/repos/registry-submission``; this component only wires the
 * network resolution + UI state.
 */

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, Send, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "../../../api/client";
import { useI18n } from "../../../hooks/ui/useI18n";
import { getStorage, resolveStorageMode } from "../../../storage";
import {
  parseGitHubRepoUrl,
  readUserRepos,
  userRepoSource,
  type UserContentRepo,
} from "../../../lib/content/repos/content-repos";
import { validateUserRepo } from "../../../lib/content/repos/content-repo-validate";
import {
  fetchGitHubFileText,
  fetchLatestCommitSha,
} from "../../../lib/content/repos/github-fetch";
import { resolveRepoToken } from "../../../lib/content/repos/repo-token";
import {
  OFFICIAL_CONTENT_REPO,
  REGISTRY_FILE,
  buildRegistryEntry,
  buildRegistryPrBody,
  buildRegistryPrTitle,
  languagePairs,
  registryBranchName,
  registryEditUrl,
  registryEntryJson,
} from "../../../lib/content/repos/registry-submission";
import type { RegistryEntry } from "../../../lib/content/repos/registry-types";
import { SEARCH_INDEX_FILE } from "../../../lib/content/repos/search-index-loader";
import { notify } from "../../../utils/notify";

/**
 * Map a programmatic registry-PR failure to an actionable message, reusing the
 * ShareWizard's already-translated ``share.pr.err_*`` keys. A configured token
 * can still be invalid or lack ``repo`` scope, so a 401/403 at submit time
 * means "token rejected" — point the user at where to fix it (#1514) instead
 * of a generic "could not open" toast.
 */
function registryPrErrorMessage(
  err: unknown,
  t: (key: string, fallback?: string) => string,
): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return t(
        "share.pr.err_auth",
        "Your GitHub token was rejected. Check it in Settings > Integrations.",
      );
    }
    if (err.status === 429) {
      return t(
        "share.pr.err_rate",
        "GitHub rate limit reached. Please try again later.",
      );
    }
    return t(
      "share.pr.err_github",
      "GitHub rejected the request: {detail}",
    ).replace("{detail}", err.detail);
  }
  return t(
    "share.pr.err_network",
    "Could not reach GitHub. Check your connection and try again.",
  );
}

/** The prepared submission, ready to copy or push. */
interface Prepared {
  entry: RegistryEntry;
  json: string;
  prTitle: string;
  prBody: string;
  editUrl: string;
  /** Local validation status carried into the entry. */
  status: "validated" | "pending";
  /** Failure reason when the local validation did not pass. */
  reason?: string;
}

/** Derive ``languages`` + ``index_schema_version`` from the repo's index. */
async function readIndexMeta(
  source: string,
  ref: string,
  token: string,
): Promise<{ languages: string[]; schemaVersion?: string }> {
  try {
    const raw = await fetchGitHubFileText(source, ref, SEARCH_INDEX_FILE, token);
    const data = JSON.parse(raw) as {
      schema_version?: unknown;
      sets?: unknown;
    };
    const sets = Array.isArray(data.sets)
      ? (data.sets as Array<{
          source_language?: unknown;
          target_language?: unknown;
        }>).map((s) => ({
          source_language:
            typeof s.source_language === "string" ? s.source_language : "",
          target_language:
            typeof s.target_language === "string" ? s.target_language : "",
        }))
      : [];
    return {
      languages: languagePairs(sets),
      schemaVersion:
        typeof data.schema_version === "string" ? data.schema_version : undefined,
    };
  } catch {
    // No index / unreachable — the CI validates the index regardless; leave
    // languages empty and the schema version out.
    return { languages: [] };
  }
}

export default function RegistrySubmitSection() {
  const { t } = useI18n();
  const [repos, setRepos] = useState<UserContentRepo[]>([]);
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenConfigured, setTokenConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [stored, status] = await Promise.all([
        readUserRepos().catch(() => []),
        getStorage()
          .github.getStatus()
          .catch(() => ({ configured: false, source: "none" as const })),
      ]);
      if (cancelled) return;
      setRepos(stored);
      setTokenConfigured(Boolean(status.configured));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Fill the form from a connected repo when the user picks one. */
  const pickRepo = useCallback(
    (source: string) => {
      const repo = repos.find((r) => userRepoSource(r.owner, r.repo) === source);
      if (!repo) return;
      setUrl(repo.url || userRepoSource(repo.owner, repo.repo));
      setBranch(repo.branch || "main");
      setTitle((prev) => prev || repo.url || userRepoSource(repo.owner, repo.repo));
      setPrepared(null);
      setPrUrl(null);
    },
    [repos],
  );

  const handlePrepare = useCallback(async () => {
    const parsed = parseGitHubRepoUrl(url);
    if (!parsed) {
      notify.error(
        t(
          "registry.error.invalid_url",
          "Enter a valid GitHub repository URL (e.g. owner/repo).",
        ),
      );
      return;
    }
    if (!title.trim()) {
      notify.error(t("registry.error.no_title", "Add a short title for your repository."));
      return;
    }
    setBusy(true);
    setPrepared(null);
    setPrUrl(null);
    try {
      const source = userRepoSource(parsed.owner, parsed.repo);
      const branchName = branch.trim() || "main";
      const token = resolveRepoToken(source);

      const commit = await fetchLatestCommitSha(source, branchName, token);
      if (!commit) {
        notify.error(
          t(
            "registry.error.no_commit",
            "Could not resolve the latest commit — check the repository URL and branch.",
          ),
        );
        return;
      }

      const validation = await validateUserRepo(
        { owner: parsed.owner, repo: parsed.repo, branch: branchName },
        token,
      );
      const status: "validated" | "pending" = validation.ok
        ? "validated"
        : "pending";

      const { languages, schemaVersion } = await readIndexMeta(
        source,
        commit,
        token,
      );

      const entry = buildRegistryEntry({
        owner: parsed.owner,
        repo: parsed.repo,
        branch: branchName,
        commit,
        title: title.trim(),
        description: description.trim() || undefined,
        trustLevel: 1,
        languages,
        validationStatus: status,
        validatedAt: new Date().toISOString(),
        indexSchemaVersion: schemaVersion,
      });

      setPrepared({
        entry,
        json: registryEntryJson(entry),
        prTitle: buildRegistryPrTitle(entry),
        prBody: buildRegistryPrBody(entry),
        editUrl: registryEditUrl(),
        status,
        reason: validation.ok ? undefined : validation.reason,
      });
    } catch {
      notify.error(
        t("registry.error.prepare_failed", "Could not prepare the submission."),
      );
    } finally {
      setBusy(false);
    }
  }, [url, branch, title, description, t]);

  const handleCopy = useCallback(async () => {
    if (!prepared) return;
    try {
      await navigator.clipboard.writeText(prepared.json);
      setCopied(true);
      notify.success(t("registry.copied", "Entry copied to the clipboard."));
    } catch {
      setCopied(false);
      notify.error(t("registry.copy_failed", "Could not copy — select the text manually."));
    }
  }, [prepared, t]);

  const handleCreatePr = useCallback(async () => {
    if (!prepared) return;
    setBusy(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const parsed = parseGitHubRepoUrl(prepared.entry.url);
      const branchName = registryBranchName(
        parsed?.owner ?? "repo",
        parsed?.repo ?? "content",
        date,
      );
      const result = await getStorage().github.createRegistryPr({
        upstream: OFFICIAL_CONTENT_REPO,
        baseBranch: "main",
        branchName,
        registryFile: REGISTRY_FILE,
        entry: prepared.entry,
        prTitle: prepared.prTitle,
        prBody: prepared.prBody,
      });
      setPrUrl(result.url);
      notify.success(t("registry.pr.created", "Pull request opened."));
    } catch (err) {
      notify.error(registryPrErrorMessage(err, t), {
        apiError: err instanceof ApiError ? err : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [prepared, t]);

  const canCreatePr = resolveStorageMode() === "dexie" && tokenConfigured;

  return (
    <section
      className="settings-section"
      data-testid="registry-submit-section"
    >
      <h2>{t("registry.title", "Register your repository")}</h2>
      <p className="m-0 mb-3 text-sm text-[var(--fg-muted)]">
        {t(
          "registry.intro",
          "Propose your own content repository for the cross-repo search. This prepares a pull request against the official content directory; a maintainer reviews and merges it after CI validates your pinned commit.",
        )}
      </p>

      <div
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4"
        data-testid="registry-submit-form"
      >
        {repos.length > 0 && (
          <label className="mb-3 flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {t("registry.field.pick", "Pick a connected repository")}
            </span>
            <select
              className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-3"
              defaultValue=""
              onChange={(e) => e.target.value && pickRepo(e.target.value)}
              data-testid="registry-repo-select"
            >
              <option value="">
                {t("registry.field.pick_placeholder", "— choose or enter below —")}
              </option>
              {repos.map((r) => {
                const source = userRepoSource(r.owner, r.repo);
                return (
                  <option key={source} value={source}>
                    {source}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {t("registry.field.url", "GitHub repository URL")}
            </span>
            <Input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              data-testid="registry-url"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex max-w-[12rem] flex-col gap-1 text-sm">
              <span className="font-medium">
                {t("registry.field.branch", "Branch")}
              </span>
              <Input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                data-testid="registry-branch"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">
                {t("registry.field.title", "Title")}
              </span>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("registry.field.title_ph", "Your set collection")}
                data-testid="registry-title"
                autoComplete="off"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {t("registry.field.description", "Description (optional)")}
            </span>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(
                "registry.field.description_ph",
                "One line about what's inside",
              )}
              data-testid="registry-description"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11 gap-2"
            onClick={handlePrepare}
            disabled={busy || !url.trim() || !title.trim()}
            data-testid="registry-prepare"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
            )}
            {t("registry.action.prepare", "Prepare submission")}
          </Button>
        </div>
      </div>

      {prepared && (() => {
        // Hoist the status comparison out of any className expression: the
        // dead-classname detector scrapes string literals from className={…},
        // so a bare "validated" literal inside it reads as a phantom class.
        const isValidated = prepared.status === "validated";
        return (
        <div
          className="mt-4 rounded-md border border-[var(--border)] bg-[var(--surface)] p-4"
          data-testid="registry-result"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-base font-semibold">
              {t("registry.result.title", "Your registry entry")}
            </h3>
            <span
              className={
                isValidated
                  ? "rounded-sm bg-[var(--success-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--success)]"
                  : "rounded-sm bg-[var(--warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--warning)]"
              }
              data-testid="registry-status"
            >
              {isValidated
                ? t("registry.status.validated", "Validated locally")
                : t("registry.status.pending", "Pending — CI will validate")}
            </span>
          </div>
          {!isValidated && prepared.reason && (
            <p
              className="m-0 mb-2 text-sm text-[var(--warning)]"
              data-testid="registry-reason"
            >
              {t("registry.result.reason", "Local check: {reason}").replace(
                "{reason}",
                prepared.reason,
              )}
            </p>
          )}
          <p className="m-0 mb-2 text-sm text-[var(--fg-muted)]">
            {t(
              "registry.result.instructions",
              "Add this entry to the {file} array of the official content directory:",
            ).replace("{file}", REGISTRY_FILE)}
          </p>
          <textarea
            readOnly
            className="min-h-[14rem] w-full rounded-md border border-[var(--border)] bg-[var(--bg-primary)] p-3 font-mono text-xs"
            value={prepared.json}
            data-testid="registry-json"
            aria-label={t("registry.result.title", "Your registry entry")}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2"
              onClick={handleCopy}
              data-testid="registry-copy"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              {copied
                ? t("registry.action.copied", "Copied")
                : t("registry.action.copy", "Copy entry")}
            </Button>
            <a
              href={prepared.editUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="registry-edit-link"
            >
              <Button type="button" variant="outline" className="min-h-11 gap-2">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t("registry.action.propose", "Open the directory to propose")}
              </Button>
            </a>
            {canCreatePr && (
              <Button
                type="button"
                className="min-h-11 gap-2"
                onClick={handleCreatePr}
                disabled={busy}
                data-testid="registry-create-pr"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                {t("registry.action.create_pr", "Create pull request")}
              </Button>
            )}
          </div>
          {prUrl && (
            <p className="m-0 mt-3 text-sm" data-testid="registry-pr-url">
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                {t("registry.pr.view", "View your pull request")} →
              </a>
            </p>
          )}
        </div>
        );
      })()}
    </section>
  );
}
