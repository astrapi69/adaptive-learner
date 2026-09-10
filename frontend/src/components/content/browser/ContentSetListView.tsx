/**
 * Compact list view of downloaded content sets (#1240).
 *
 * The opt-in alternative to the rich {@link ContentTree}: a flat,
 * fast-to-scroll list. Mobile-first — each row shows the set title
 * only; LANGUAGE sets additionally show the language codes
 * (``de→en``). Knowledge-domain sets (psychology, programming, …)
 * show the title alone, since a source→target pair is not meaningful
 * there. On wider screens the row adds the level + lesson count.
 *
 * The language-vs-knowledge decision reuses the shared
 * {@link isKnowledgeDomain} helper (DRY — same rule the exercise
 * renderers use), so the two surfaces can never drift. Each row links
 * to the single-set deep link ``/content/set/:setId``.
 *
 * A set with a pending update (#3081) shows the same "Update available"
 * badge as the tile view and an Update button on the tile view's own
 * download path (``onDownload``, with the #2128 guard), so the held-back
 * toast's "confirm it with the set's Update button" points at something in
 * the list view too.
 */

import { Download } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { useI18n } from "../../../hooks/ui/useI18n";
import { isKnowledgeDomain } from "../../../lib/exercises/knowledge-domain";
import DownloadedAtReadout from "../../dev/DownloadedAtReadout";
import type { DownloadState } from "./ContentSetRow";
import SetActionsMenu from "./SetActionsMenu";
import SetShareButton from "../share/SetShareButton";
import type { ContentSetEntry, SetStatus } from "../../../storage/types";

/** #1351 — the multi-select wiring, forwarded to every row. */
interface SelectionProps {
  /** When true, each row shows a selection checkbox. */
  selectable?: boolean;
  /** Selected keys (``${source}#${id}``). */
  selectedKeys?: Set<string>;
  /** Toggle a row's selection. */
  onToggleSelect?: (entry: ContentSetEntry) => void;
}

interface ContentSetListViewProps extends SelectionProps {
  sets: ContentSetEntry[];
  /** #1300 — change a set's lifecycle status. Omit to hide the
   *  per-set overflow menu (e.g. search results). */
  onSetStatus?: (entry: ContentSetEntry, status: SetStatus) => void;
  /** #1300 — open the delete-confirm dialog for a set. */
  onDelete?: (entry: ContentSetEntry) => void;
  /** EXP-051 / #2125 — start a new Durchgang for a completed set. */
  onRestart?: (entry: ContentSetEntry) => void;
  /** EXP-046 item 3 / #2654 — fork this set into a user-generated copy and
   *  open it in the editor (overflow menu). */
  onEditAsCopy?: (entry: ContentSetEntry) => void;
  /** #3081 — the tile view's download/update path for a set with a
   *  pending update. Omit to hide the row's Update button. */
  onDownload?: (entry: ContentSetEntry) => void;
  /** #3081 — per-set download state (``source#id``), disables the button
   *  while a download runs. */
  perSetState?: Record<string, DownloadState>;
  /** #3081 — offline disables the Update button (same rule as the tile). */
  online?: boolean;
}

/** Stable selection key for a set (source + id). */
export function setSelectionKey(entry: {
  source: string;
  id: string;
}): string {
  return `${entry.source}#${entry.id}`;
}

function ContentSetListRow({
  entry,
  onSetStatus,
  onDelete,
  onRestart,
  onEditAsCopy,
  onDownload,
  downloadState,
  online,
  selectable,
  selectedKeys,
  onToggleSelect,
}: {
  entry: ContentSetEntry;
  onSetStatus?: (entry: ContentSetEntry, status: SetStatus) => void;
  onDelete?: (entry: ContentSetEntry) => void;
  onRestart?: (entry: ContentSetEntry) => void;
  onEditAsCopy?: (entry: ContentSetEntry) => void;
  onDownload?: (entry: ContentSetEntry) => void;
  downloadState: DownloadState;
  online: boolean;
} & SelectionProps) {
  const { t } = useI18n();
  const knowledge = isKnowledgeDomain(entry.domain, entry.source_language, entry.target_language);
  const showUpdate = entry.update_available && onDownload !== undefined;
  return (
    <li>
      {/* #3081 — flex-wrap + basis-40: on a phone the badge + Update button
          drop to a second line instead of squeezing the title to nothing
          (the #3027 reorder-row pattern). */}
      <div className="flex flex-wrap items-center gap-1">
        {selectable && (
          <label className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
            <span className="sr-only">
              {t("content.set_status.select_set", "Select {title}").replace(
                "{title}",
                entry.title,
              )}
            </span>
            <Checkbox
              checked={selectedKeys?.has(setSelectionKey(entry)) ?? false}
              onCheckedChange={() => onToggleSelect?.(entry)}
              aria-label={t("content.set_status.select_set", "Select {title}").replace(
                "{title}",
                entry.title,
              )}
              data-testid={`content-select-${entry.id}`}
            />
          </label>
        )}
        {/* #1392 — min-w-0 lets the flex-1 link shrink below its content
            width, so the nested truncate can act and the badge + actions
            menu stay inside the viewport for EVERY title length. */}
        <Link
          to={`/content/set/${entry.id}`}
          className="flex min-h-11 min-w-0 flex-1 basis-40 items-center gap-2 rounded-md px-2 py-1.5 text-fg-primary hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid={`content-list-set-${entry.id}`}
        >
          <span className="min-w-0 flex-1 truncate font-medium" title={entry.title}>
            {entry.title}
          </span>
          {!knowledge && (
            <span
              className="shrink-0 text-xs font-semibold uppercase text-muted-foreground"
              data-testid={`content-list-set-${entry.id}-langs`}
            >
              {entry.source_language.toLowerCase()}
              {"→"}
              {entry.target_language.toLowerCase()}
            </span>
          )}
          {/* Desktop-only extra context; mobile stays minimal. */}
          <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
            {entry.level}
            {" · "}
            {entry.lesson_count} {t("content.lessons", "lessons")}
          </span>
        </Link>
        {entry.update_available && (
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <span
              className="content-set-update shrink-0"
              data-testid={`content-set-${entry.id}-update`}
            >
              {t("content.status.update_available", "Update available")}
            </span>
            {showUpdate && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => onDownload?.(entry)}
                disabled={downloadState === "downloading" || !online}
                title={!online ? t("pwa.action_unavailable", "Not available offline") : undefined}
                data-testid={`content-set-${entry.id}-action`}
              >
                <Download size={14} aria-hidden="true" />
                {t("content.action.update", "Update")}
              </Button>
            )}
          </span>
        )}
        {/* #1572 — per-set Share (deep link + QR). */}
        <SetShareButton entry={entry} />
        {/* #1300 — per-set status + delete overflow menu (same component
            as the grid view, so the actions can never drift). */}
        {onSetStatus && onDelete && (
          <SetActionsMenu
            entry={entry}
            status={entry.status ?? "active"}
            onSetStatus={(status) => onSetStatus(entry, status)}
            onDelete={() => onDelete(entry)}
            onRestart={onRestart ? () => onRestart(entry) : undefined}
            onEditAsCopy={onEditAsCopy ? () => onEditAsCopy(entry) : undefined}
          />
        )}
      </div>
      {/* #1298 — the Dev-Mode download-date diagnostic (the #1259 readout,
          extended from the Learning Path SetRow to "Meine Inhalte"). */}
      <DownloadedAtReadout
        downloadedAt={entry.downloaded_at}
        testId={`content-list-set-${entry.id}-downloaded-at`}
        className="block px-2 pb-1"
      />
    </li>
  );
}

export default function ContentSetListView({
  sets,
  onSetStatus,
  onDelete,
  onRestart,
  onEditAsCopy,
  onDownload,
  perSetState,
  online = true,
  selectable,
  selectedKeys,
  onToggleSelect,
}: ContentSetListViewProps) {
  return (
    <ul className="flex flex-col gap-0.5" data-testid="content-list-view">
      {sets.map((entry) => (
        <ContentSetListRow
          key={`${entry.source}#${entry.id}`}
          entry={entry}
          onSetStatus={onSetStatus}
          onDelete={onDelete}
          onRestart={onRestart}
          onEditAsCopy={onEditAsCopy}
          onDownload={onDownload}
          downloadState={perSetState?.[`${entry.source}#${entry.id}`] ?? "idle"}
          online={online}
          selectable={selectable}
          selectedKeys={selectedKeys}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </ul>
  );
}
