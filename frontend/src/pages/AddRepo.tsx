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

import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useI18n } from "../hooks/useI18n";
import {
  addUserRepo,
  parseGitHubRepoUrl,
  syncUserRepo,
  userRepoSource,
} from "../lib/content/content-repos";
import { validateUserRepo } from "../lib/content/content-repo-validate";
import { notify } from "../utils/notify";

export default function AddRepo() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = params.get("url") ?? "";
  const branch = params.get("branch") || "main";
  const parsed = useMemo(() => parseGitHubRepoUrl(url), [url]);

  const handleConnect = useCallback(async () => {
    if (!parsed) return;
    setBusy(true);
    setError(null);
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
      await syncUserRepo(source);
      notify.success(
        t("content_repo.added", "Repository added."),
      );
      navigate("/content");
    } catch {
      setError(
        t("content_repo.error.save_failed", "Could not add the repository."),
      );
    } finally {
      setBusy(false);
    }
  }, [parsed, branch, url, navigate, t]);

  return (
    <main id="main" className="page" data-testid="add-repo-page">
      <div className="mx-auto mt-10 max-w-md rounded-md border border-[var(--border)] bg-[var(--surface)] p-6">
        <h1 className="m-0 text-xl font-semibold">
          {t("content_repo.add_link.title", "Add this content repository?")}
        </h1>
        {parsed ? (
          <>
            <p className="mt-3 text-sm text-[var(--fg-muted)]">
              {t(
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
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={handleConnect}
                disabled={busy}
                data-testid="add-repo-connect"
              >
                {t("content_repo.action.connect", "Connect repository")}
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
    </main>
  );
}
