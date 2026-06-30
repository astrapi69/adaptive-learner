/**
 * Compact list view of discoverable content sets (#1262).
 *
 * The list alternative to the {@link SetDiscoveryCard} grid on the
 * Discover tab, mirroring the downloaded-set list view (#1240): each row
 * shows the set title; LANGUAGE sets additionally show the language pair
 * (``de→es``), while knowledge-domain sets show the title alone — the
 * same {@link isKnowledgeDomain} rule the downloaded list uses, so the
 * two surfaces can't drift. The row keeps the Discover download / remove
 * action (the sets here are not downloaded yet, so it can't link to a
 * set deep-link the way the downloaded list does).
 *
 * Props-driven and presentational — the host (Discover) owns the data,
 * the download/remove handlers, and the per-set state.
 */

import { Button } from "@/components/ui/button";

import { isKnowledgeDomain } from "../../lib/exercises/knowledge-domain";
import type { SearchableSet } from "../../lib/content/repos/search-index-loader";
import type { SetDiscoveryDownloadState } from "./SetDiscoveryCard";

/** Localized labels shared with the {@link SetDiscoveryCard}. */
export interface DiscoverListLabels {
  download: string;
  downloading: string;
  retry: string;
  downloaded: string;
  remove: string;
  /** Builder for "{n} lessons" (desktop-only context). */
  lessons: (count: number) => string;
}

interface DiscoverSetListViewProps {
  sets: SearchableSet[];
  keyFor: (set: SearchableSet) => string;
  isDownloaded: (set: SearchableSet) => boolean;
  stateFor: (set: SearchableSet) => SetDiscoveryDownloadState;
  /** Whether this set's repo allows removal (official repos do not). */
  canRemove: (set: SearchableSet) => boolean;
  onDownload: (set: SearchableSet) => void;
  onRemove: (set: SearchableSet) => void;
  labels: DiscoverListLabels;
}

function langPair(set: SearchableSet): string | null {
  if (isKnowledgeDomain(set.domain, set.source_language, set.target_language)) {
    return null;
  }
  const source = (set.source_language ?? "").toLowerCase();
  const target = (set.target_language ?? "").toLowerCase();
  if (source && target) return `${source}→${target}`;
  return target || source || null;
}

function DiscoverSetListRow({
  set,
  testKey,
  downloaded,
  state,
  canRemove,
  onDownload,
  onRemove,
  labels,
}: {
  set: SearchableSet;
  testKey: string;
  downloaded: boolean;
  state: SetDiscoveryDownloadState;
  canRemove: boolean;
  onDownload: (set: SearchableSet) => void;
  onRemove: (set: SearchableSet) => void;
  labels: DiscoverListLabels;
}) {
  const pair = langPair(set);
  const isDone = downloaded || state === "done";

  return (
    <li
      className="flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--bg-elevated)]"
      data-testid={`discover-list-${set.id}`}
    >
      <span className="flex-1 truncate font-medium text-fg-primary">{set.name}</span>
      {pair && (
        <span
          className="shrink-0 text-xs font-semibold uppercase text-muted-foreground"
          data-testid={`discover-list-${set.id}-langs`}
        >
          {pair}
        </span>
      )}
      <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
        {labels.lessons(set.lesson_count)}
      </span>
      {isDone ? (
        <span className="flex shrink-0 items-center gap-2">
          <span
            className="text-xs text-muted-foreground"
            data-testid={`discover-list-${testKey}-downloaded`}
          >
            {labels.downloaded}
          </span>
          {canRemove && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => onRemove(set)}
              data-testid={`discover-list-${testKey}-remove`}
            >
              {labels.remove}
            </Button>
          )}
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant={state === "error" ? "outline" : "default"}
          className="min-h-11 shrink-0"
          disabled={state === "downloading"}
          onClick={() => onDownload(set)}
          data-testid={`discover-list-${testKey}-download`}
        >
          {state === "downloading"
            ? labels.downloading
            : state === "error"
              ? labels.retry
              : labels.download}
        </Button>
      )}
    </li>
  );
}

export default function DiscoverSetListView({
  sets,
  keyFor,
  isDownloaded,
  stateFor,
  canRemove,
  onDownload,
  onRemove,
  labels,
}: DiscoverSetListViewProps) {
  return (
    <ul className="flex flex-col gap-0.5" data-testid="discover-list-view">
      {sets.map((set) => (
        <DiscoverSetListRow
          key={keyFor(set)}
          set={set}
          testKey={set.id}
          downloaded={isDownloaded(set)}
          state={stateFor(set)}
          canRemove={canRemove(set)}
          onDownload={onDownload}
          onRemove={onRemove}
          labels={labels}
        />
      ))}
    </ul>
  );
}
