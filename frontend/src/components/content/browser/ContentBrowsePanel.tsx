/**
 * ContentBrowsePanel (#1793 — extracted from Content.tsx).
 *
 * The browse branch of the Content Browser: the "Downloaded sets"
 * title + #1240 view toggle, the empty / filter-empty states (#1386
 * one-tap reset), the #1351 select-all row + bulk-action bar, and
 * the list ⇄ tree dispatch. Pure composition — every piece of state
 * and every handler arrives via props; the tree's large prop bundle
 * passes through untouched.
 */

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import BulkActionBar from "./BulkActionBar";
import ContentSetListView, { setSelectionKey } from "./ContentSetListView";
import ContentTree from "./ContentTree";
import ContentViewToggle from "./ContentViewToggle";
import { useI18n } from "../../../hooks/ui/useI18n";
import type { useSetSelection } from "../../../hooks/content/useSetSelection";
import type { ContentViewMode } from "../../../lib/content/browse/viewModePref";
import type { ContentSetEntry, SetStatus } from "../../../storage/types";

export interface ContentBrowsePanelProps {
  hasDownloadedSets: boolean;
  visibleSets: ContentSetEntry[];
  viewMode: ContentViewMode;
  onViewModeChange: (mode: ContentViewMode) => void;
  onResetFilters: () => void;
  selection: ReturnType<typeof useSetSelection>;
  onBulkSetStatus: (status: SetStatus) => void;
  onBulkDelete: () => void;
  onSetStatus: (entry: ContentSetEntry, status: SetStatus) => void;
  onDeleteSet: (entry: ContentSetEntry) => void;
  treeProps: ComponentProps<typeof ContentTree>;
}

/**
 * Render the downloaded-sets browse section.
 *
 * @example
 * <ContentBrowsePanel visibleSets={filters.visibleSets}
 *     selection={selection} treeProps={{tree, ...}} ... />
 */
export default function ContentBrowsePanel({
  hasDownloadedSets,
  visibleSets,
  viewMode,
  onViewModeChange,
  onResetFilters,
  selection,
  onBulkSetStatus,
  onBulkDelete,
  onSetStatus,
  onDeleteSet,
  treeProps,
}: ContentBrowsePanelProps) {
  const { t } = useI18n();
  const visibleKeys = visibleSets.map(setSelectionKey);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="content-section-title">
          {t("content.my_lessons.downloaded_title", "Downloaded sets")}
        </h2>
        {hasDownloadedSets && (
          <ContentViewToggle mode={viewMode} onChange={onViewModeChange} />
        )}
      </div>
      {!hasDownloadedSets ? (
        <p className="content-empty" data-testid="content-empty">
          {t(
            "content.empty",
            "No content sets available yet. Check your network connection and refresh, or configure a source in Settings.",
          )}
        </p>
      ) : visibleSets.length === 0 ? (
        /* #1386 — the active filters match nothing: say so and offer a
           one-tap reset instead of a dead-end blank list. */
        <div className="content-empty" data-testid="content-filter-empty">
          <p>
            {t("content.filter_empty", "No sets match the active filters.")}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 min-h-11"
            onClick={onResetFilters}
            data-testid="content-filter-reset"
          >
            {t("content.filter_reset", "Reset filters")}
          </Button>
        </div>
      ) : (
        <>
          {/* #1351 — multi-select: select-all over the VISIBLE (filtered)
              sets + the bulk-action bar (shown once ≥1 is selected). */}
          <div
            className="mb-2 flex items-center gap-2"
            data-testid="content-select-all-row"
          >
            <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
              <span className="sr-only">
                {t("content.set_status.select_all", "Select all")}
              </span>
              <Checkbox
                checked={selection.masterState(visibleKeys)}
                onCheckedChange={() => selection.selectAll(visibleKeys)}
                aria-label={t("content.set_status.select_all", "Select all")}
                data-testid="content-select-all"
              />
            </label>
            <span className="text-sm text-muted-foreground">
              {t("content.set_status.select_all", "Select all")}
            </span>
          </div>
          <BulkActionBar
            count={selection.count}
            onSetStatus={onBulkSetStatus}
            onDelete={onBulkDelete}
            onClear={selection.clear}
          />
          {viewMode === "list" ? (
            <ContentSetListView
              sets={visibleSets}
              onSetStatus={onSetStatus}
              onDelete={onDeleteSet}
              selectable
              selectedKeys={selection.selected}
              onToggleSelect={(e) => selection.toggle(setSelectionKey(e))}
            />
          ) : (
            <ContentTree {...treeProps} />
          )}
        </>
      )}
    </>
  );
}
