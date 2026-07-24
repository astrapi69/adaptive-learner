/**
 * Deep-link "Add repository?" page (EXP-023 Phase B).
 *
 * Opened by a share link ``/add-repo?url=…&branch=…``. Shows a confirm
 * dialog for the named repo; "Connect" validates it, adds it to the user's
 * repo list, syncs it, and goes to the Content Browser; "Cancel" returns to
 * the Dashboard. No token travels in the link — only public repos connect
 * this way (a private/coach repo is added manually in Settings with its
 * token).
 */

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import DownloadProgress from "../../shared/feedback/DownloadProgress";
import { useI18n } from "../../hooks/ui/useI18n";
import {
  addUserRepo,
  findUserRepo,
  isOfficialSource,
  parseGitHubRepoUrl,
  syncUserRepo,
  syncPhaseI18n,
  userRepoSource,
  type SyncProgress,
} from "../../lib/content/repos/content-repos";
import { validateUserRepo } from "../../lib/content/repos/content-repo-validate";
import PageContainer from "../../shared/layout/PageContainer";
import { getStorage } from "../../storage";
import { notify } from "../../utils/notify";

export default function AddRepo() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    label: string;
    current: number;
    total: number;
  } | null>(null);

  const url = params.get("url") ?? "";
  const branch = params.get("branch") || "main";
  const set = params.get("set") ?? "";
  const parsed = useMemo(() => parseGitHubRepoUrl(url), [url]);

  // #1572 — while we decide whether an already-connected repo lets us jump
  // straight to the shared set (no dialog), suppress the confirm card so it
  // never flashes before the redirect.
  const [checking, setChecking] = useState(set.length > 0);

  /** Route to the shared set's deep-link page (opens/downloads it). */
  const goToSet = useCallback(
    (setId: string) => navigate(`/content/set/${encodeURIComponent(setId)}`),
    [navigate],
  );

  // #1572 — a per-set link whose repo is already connected (or the always-loaded
  // official repo) skips the dialog and opens the set directly.
  useEffect(() => {
    if (!set || !parsed) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const source = userRepoSource(parsed.owner, parsed.repo);
      let connected = isOfficialSource(source);
      if (!connected) {
        const existing = await findUserRepo(source);
        connected = !!existing && existing.branch === branch;
      }
      if (cancelled) return;
      if (connected) {
        goToSet(set);
      } else {
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [set, parsed, branch, goToSet]);

  const handleConnect = useCallback(async () => {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    setProgress({
      label: t("content_repo.progress.validating", "Validating repository…"),
      current: 0,
      total: 0,
    });
    try {
      const source = userRepoSource(parsed.owner, parsed.repo);
      const validation = await validateUserRepo({
        owner: parsed.owner,
        repo: parsed.repo,
        branch,
      });
      if (!validation.ok) {
        setError(
          t("content_repo.validation.failed", "Validation failed: {reason}").replace(
            "{reason}",
            validation.reason ?? "",
          ),
        );
        return;
      }
      await addUserRepo({
        url,
        owner: parsed.owner,
        repo: parsed.repo,
        branch,
        connected: true,
        last_synced: null,
        set_count: validation.setCount,
        lesson_count: validation.lessonCount,
        trust: 1,
      });
      await syncUserRepo(source, (p: SyncProgress) => {
        const { key, fallback } = syncPhaseI18n(p.phase);
        setProgress({ label: t(key, fallback), current: p.current, total: p.total });
      });
      notify.success(
        t("content_repo.added", "Repository added."),
      );
      if (set) {
        // #1572 — verify the shared set actually exists in the freshly
        // connected repo before navigating; a stale/renamed slug gets a clear
        // error + Dashboard fallback instead of a silent dead end.
        const { sets } = await getStorage().contentLoader.listSets();
        const found = sets.some((s) => s.id === set && s.source === source);
        if (found) {
          goToSet(set);
        } else {
          setError(
            t(
              "content_repo.set_not_found",
              "The set '{set}' was not found in this repository.",
            ).replace("{set}", set),
          );
        }
        return;
      }
      navigate("/content?tab=my");
    } catch {
      setError(
        t("content_repo.error.save_failed", "Could not add the repository."),
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [parsed, branch, url, set, navigate, goToSet, t]);

  if (checking) {
    return (
      <PageContainer testId="add-repo-page">
        <div className="mx-auto mt-10 max-w-md rounded-md border border-[var(--border)] bg-[var(--surface)] p-6">
          <p
            className="flex items-center gap-2 text-sm text-[var(--fg-muted)]"
            role="status"
            aria-live="polite"
            data-testid="add-repo-checking"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("content.set_link.loading", "Loading set…")}
          </p>
        </div>
      </PageContainer>
    );
  }

  const hasSet = set.length > 0;

  return (
    <PageContainer testId="add-repo-page">
      <div className="mx-auto mt-10 max-w-md rounded-md border border-[var(--border)] bg-[var(--surface)] p-6">
        <h1 className="m-0 text-xl font-semibold">
          {hasSet
            ? t("content_repo.add_link.title_set", "Connect repository and open set?")
            : t("content_repo.add_link.title", "Add this content repository?")}
        </h1>
        {parsed ? (
          <>
            <p
              className="mt-3 text-sm text-[var(--fg-muted)]"
              data-testid="add-repo-body"
            >
              {hasSet
                ? t(
                    "content_repo.add_link.body_set",
                    "Connect the repository '{repo}' and open the set '{set}'.",
                  )
                    .replace("{repo}", userRepoSource(parsed.owner, parsed.repo))
                    .replace("{set}", set)
                : t(
                    "content_repo.add_link.body",
                    "You were invited to add a content repository to Adaptive Learner.",
                  )}
            </p>
            <p className="mt-2 font-medium" data-testid="add-repo-name">
              <code>{userRepoSource(parsed.owner, parsed.repo)}</code>{" "}
              <span className="text-sm text-[var(--fg-muted)]">@{branch}</span>
            </p>
            {error && (
              <p
                className="mt-3 text-sm font-medium text-[var(--error)]"
                role="status"
                data-testid="add-repo-error"
              >
                {error}
              </p>
            )}
            {progress && (
              <div
                className="mt-3 flex flex-col gap-2"
                role="status"
                aria-live="polite"
                data-testid="add-repo-progress"
              >
                <span className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {progress.total > 0
                    ? `${progress.label} (${progress.current}/${progress.total})`
                    : progress.label}
                </span>
                {progress.total > 0 && (
                  <DownloadProgress
                    current={progress.current}
                    total={progress.total}
                    ariaLabel={progress.label}
                    testId="add-repo-progress-bar"
                  />
                )}
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={handleConnect}
                disabled={busy}
                data-testid="add-repo-connect"
              >
                {hasSet
                  ? t("content_repo.action.connect_and_open", "Connect and open")
                  : t("content_repo.action.connect", "Connect repository")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => navigate("/dashboard")}
                disabled={busy}
                data-testid="add-repo-cancel"
              >
                {t("content_repo.action.cancel", "Cancel")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p
              className="mt-3 text-sm font-medium text-[var(--error)]"
              data-testid="add-repo-invalid"
            >
              {t(
                "content_repo.add_link.invalid",
                "This invite link does not contain a valid repository.",
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-5 min-h-11"
              onClick={() => navigate("/dashboard")}
              data-testid="add-repo-cancel"
            >
              {t("content_repo.action.cancel", "Cancel")}
            </Button>
          </>
        )}
      </div>
    </PageContainer>
  );
}
