/**
 * The card a short set link (``/content/set/<id>``) shows when the set lives
 * in a registry repo the learner has not added yet (#3819).
 *
 * It shows the set as the repo's search index describes it and says which
 * repo it comes from. "Add & start" connects that repo, reads the fresh set
 * listing and hands the now-loadable set to the page, which downloads and
 * opens it.
 */

import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../hooks/ui/useI18n";
import { connectPublicRepo } from "../../lib/content/repos/shared-link/connect-repo";
import { repoValidationReasonText } from "../../lib/content/repos/content-repo-validate";
import { syncPhaseI18n, type SyncProgress } from "../../lib/content/repos/content-repos";
import type { RegistryRepoRef } from "../../lib/content/repos/shared-link/registry-set-lookup";
import type { SearchableSet } from "../../lib/content/repos/search-index-loader";
import DownloadProgress from "../../shared/feedback/DownloadProgress";
import { getStorage } from "../../storage";
import type { ContentSetEntry } from "../../storage/types";
import { notify } from "../../utils/notify";

export interface RegistrySetCardProps {
  /** The set as the registry repo's search index lists it. */
  set: SearchableSet;
  /** The repo to connect. */
  repo: RegistryRepoRef;
  /** Called with the set from the app's listing once its repo is connected. */
  onConnected: (entry: ContentSetEntry) => void;
  onDiscover: () => void;
}

interface ConnectProgress {
  label: string;
  current: number;
  total: number;
}

/**
 * @example
 * <RegistrySetCard set={found.set} repo={found.repo} onConnected={startSet} onDiscover={goDiscover} />
 */
export default function RegistrySetCard({
  set,
  repo,
  onConnected,
  onDiscover,
}: RegistrySetCardProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ConnectProgress | null>(null);

  const handleAdd = useCallback(async () => {
    setBusy(true);
    setError(null);
    setProgress({
      label: t("content_repo.progress.validating", "Validating repository…"),
      current: 0,
      total: 0,
    });
    try {
      const result = await connectPublicRepo(repo, (p: SyncProgress) => {
        const { key, fallback } = syncPhaseI18n(p.phase);
        setProgress({ label: t(key, fallback), current: p.current, total: p.total });
      });
      if (!result.ok) {
        setError(
          t("content_repo.validation.failed", "Validation failed: {reason}").replace(
            "{reason}",
            repoValidationReasonText(result.validation, t),
          ),
        );
        return;
      }
      const { sets } = await getStorage().contentLoader.listSets();
      const entry = sets.find((s) => s.id === set.id && s.source === result.source);
      if (!entry) {
        setError(
          t(
            "content_repo.set_not_found",
            "The set '{set}' was not found in this repository.",
          ).replace("{set}", set.id),
        );
        return;
      }
      onConnected(entry);
    } catch (err) {
      notify.error(t("content_repo.error.save_failed", "Could not add the repository."), {
        error: err,
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [repo, set.id, onConnected, t]);

  return (
    <div data-testid="registry-set">
      <h1 className="m-0 wrap-anywhere text-xl font-semibold" data-testid="set-deep-link-title">
        {set.name}
      </h1>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--fg-muted)]">
        <span>{set.level}</span>
        <span data-testid="set-deep-link-lessons">
          {t("content.set_link.lessons", "{n} lessons").replace("{n}", String(set.lesson_count))}
        </span>
      </p>
      <p className="mt-1 text-sm text-[var(--fg-muted)]" data-testid="registry-set-repo">
        {t("content.set_link.from_repo", "From the repository {repo}").replace(
          "{repo}",
          set.repo_name,
        )}
      </p>
      {set.description && <p className="mt-3 text-sm">{set.description}</p>}
      <p className="mt-3 text-sm" data-testid="registry-set-explain">
        {t(
          "content.set_link.add_explain",
          "This set comes from a repository you have not added yet. Starting it adds that repository to your content sources.",
        )}
      </p>

      {error && (
        <p
          className="mt-3 text-sm font-medium text-[var(--error)]"
          role="status"
          data-testid="registry-set-error"
        >
          {error}
        </p>
      )}
      {progress && (
        <div
          className="mt-3 flex flex-col gap-2"
          role="status"
          aria-live="polite"
          data-testid="registry-set-progress"
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
              testId="registry-set-progress-bar"
            />
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className="min-h-11"
          onClick={handleAdd}
          disabled={busy}
          data-testid="set-deep-link-start"
        >
          {t("content.set_link.add_start", "Add & start")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onDiscover}
          disabled={busy}
          data-testid="set-deep-link-discover"
        >
          {t("content.set_link.go_discover", "Discover content")}
        </Button>
      </div>
    </div>
  );
}
