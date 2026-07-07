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
 */

import { Link } from "react-router-dom";

import { Checkbox } from "@/components/ui/checkbox";

import { useI18n } from "../../../hooks/ui/useI18n";
import { isKnowledgeDomain } from "../../../lib/exercises/knowledge-domain";
import DownloadedAtReadout from "../../dev/DownloadedAtReadout";
import SetActionsMenu from "./SetActionsMenu";
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
  selectable,
  selectedKeys,
  onToggleSelect,
}: {
  entry: ContentSetEntry;
  onSetStatus?: (entry: ContentSetEntry, status: SetStatus) => void;
  onDelete?: (entry: ContentSetEntry) => void;
} & SelectionProps) {
  const { t } = useI18n();
  const knowledge = isKnowledgeDomain(entry.domain, entry.source_language, entry.target_language);
  return (
    <li>
      <div className="flex items-center gap-1">
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
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-fg-primary hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
        {/* #1300 — per-set status + delete overflow menu (same component
            as the grid view, so the actions can never drift). */}
        {onSetStatus && onDelete && (
          <SetActionsMenu
            entry={entry}
            status={entry.status ?? "active"}
            onSetStatus={(status) => onSetStatus(entry, status)}
            onDelete={() => onDelete(entry)}
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
          selectable={selectable}
          selectedKeys={selectedKeys}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </ul>
  );
}
