/**
 * AvailableContentResults — the "Available" half of the Content Browser
 * search (EXP-034 / DIS-07).
 *
 * Alongside the learner's downloaded sets ("Your content"), the Content
 * Browser search also surfaces sets from the loaded search index that aren't
 * downloaded yet. This component loads the index once, filters it by the
 * active query (excluding already-downloaded sets), and renders the matches
 * under an "Available" heading. Clicking one prompts "not downloaded yet —
 * download now?" and then runs a per-set download (DIS-06); on success it
 * calls ``onDownloaded`` so the parent re-lists its tree.
 *
 * Self-contained (own index load + dialog + download state) so it adds no
 * complexity to the already-baselined ContentPage. Renders nothing until the
 * query is active and at least one not-downloaded set matches.
 */

import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "../../api/client";
import { useI18n } from "../../hooks/useI18n";
import { normalizeSearchText, MIN_QUERY_LENGTH } from "../../lib/content/content-search";
import {
  isSetDownloaded,
  matchesQuery,
  type LocalCachedSet,
} from "../../lib/content/discover-index";
import { collectDiscoveryRepos } from "../../lib/content/discover-repos";
import {
  fetchAllIndices,
  type SearchableSet,
} from "../../lib/content/search-index-loader";
import { getStorage } from "../../storage";
import { notify } from "../../utils/notify";

export interface AvailableContentResultsProps {
  /** The active raw search query from the Content Browser. */
  query: string;
  /** The learner's locally-cached sets (to exclude already-downloaded). */
  downloadedSets: LocalCachedSet[];
  /** Called after a successful download so the parent re-lists its tree. */
  onDownloaded: () => void;
  testId?: string;
}

function languageBadge(set: SearchableSet): string {
  const source = set.source_language ? set.source_language.toUpperCase() : "";
  const target = set.target_language ? set.target_language.toUpperCase() : "";
  if (source && target) return `${source} → ${target}`;
  return target || source;
}

export default function AvailableContentResults({
  query,
  downloadedSets,
  onDownloaded,
  testId = "content-available-results",
}: AvailableContentResultsProps) {
  const { t } = useI18n();
  const [indexSets, setIndexSets] = useState<SearchableSet[]>([]);
  const [pending, setPending] = useState<SearchableSet | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const repos = await collectDiscoveryRepos();
      const sets = await fetchAllIndices(repos);
      if (!cancelled) setIndexSets(sets);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const normalized = normalizeSearchText(query);
  const matches = useMemo(() => {
    if (normalized.length < MIN_QUERY_LENGTH) return [];
    return indexSets.filter(
      (set) =>
        matchesQuery(set, normalized) && !isSetDownloaded(set, downloadedSets),
    );
  }, [indexSets, normalized, downloadedSets]);

  if (matches.length === 0) return null;

  async function confirmDownload() {
    if (!pending) return;
    setDownloading(true);
    try {
      await getStorage().contentLoader.downloadSet(pending.repo_url, pending.id);
      notify.success(t("discover.toast.downloaded", "Set downloaded and ready to use."));
      setPending(null);
      onDownloaded();
    } catch (err) {
      notify.error(t("discover.error.download_failed", "Could not download the set."), {
        apiError: err instanceof ApiError ? err : undefined,
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="space-y-2" data-testid={testId}>
      <h2 className="font-semibold" data-testid={`${testId}-heading`}>
        {t("content.search.available", "Available to download")}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          ({matches.length})
        </span>
      </h2>
      <ul className="space-y-1">
        {matches.map((set) => (
          <li
            key={`${set.repo_url}::${set.id}`}
            className="flex items-center justify-between gap-2"
            data-testid={`${testId}-set-${set.id}`}
          >
            <span>
              {set.name}
              <span className="ml-1 text-sm text-muted-foreground">
                · {languageBadge(set)} {set.level.toUpperCase()}
              </span>
            </span>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => setPending(set)}
              data-testid={`${testId}-download-${set.id}`}
            >
              <Download className="mr-1 size-4" aria-hidden="true" />
              {t("discover.card.download", "Download")}
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent data-testid={`${testId}-dialog`}>
          <DialogHeader>
            <DialogTitle>{t("content.search.download_prompt_title", "Download this set?")}</DialogTitle>
            <DialogDescription>
              {t(
                "content.search.download_prompt_body",
                "This set isn't downloaded yet. Download it now?",
              )}
              {pending ? ` — ${pending.name}` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPending(null)}
              data-testid={`${testId}-dialog-cancel`}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              disabled={downloading}
              onClick={() => void confirmDownload()}
              data-testid={`${testId}-dialog-confirm`}
            >
              <Download className="mr-1 size-4" aria-hidden="true" />
              {downloading
                ? t("discover.card.downloading", "Downloading…")
                : t("discover.card.download", "Download")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
