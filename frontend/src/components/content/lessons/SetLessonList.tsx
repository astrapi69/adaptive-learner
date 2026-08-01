/**
 * Expandable per-lesson list of a multi-lesson user-generated set (#2064).
 *
 * The "My Lessons" section shows one row per set; a book-text import (#1949)
 * stores many lessons in one set. This disclosure lets the user open, reorder
 * (#2172), EDIT (#2210), and delete an individual lesson (Play + move Up/Down
 * + Edit + Delete per lesson). Each action carries the row's OWN lesson
 * filename, so Edit opens exactly that lesson - it replaces the set-level Edit
 * button, which could only guess the first lesson of a multi-lesson set.
 * Lessons load lazily on first expand and reload after a delete (via the
 * target's ``onDeleted`` callback).
 *
 * ## Multi-select delete (#2065): a MODE, not a sixth per-row control
 *
 * A row already carries five controls (Up / Down / Play / Edit / Delete); a
 * persistent sixth per-row checkbox would crowd the row, worst on a phone. So
 * bulk delete is a selection MODE (the same pattern as the "Combine into a set"
 * select mode): a "Select lessons" toggle replaces the per-row actions with a
 * leading checkbox while active, and a compact bar offers Select-all / Clear /
 * "Delete N". The whole selection is deleted in one confirmed, quantified
 * action owned by the page's ``useContentSetActions`` (``onRequestBulkDelete``).
 *
 * ## Reorder (#2172): display order, never identity
 *
 * The Up/Down controls persist a per-set display order via the mode-agnostic
 * {@link ../../../lib/content/browse/lesson-order-store} - an ordered list OF
 * the lesson filenames. A move is a pure permutation of existing filenames, so
 * it NEVER renames a lesson; ``LessonProgress`` and SRS rows (keyed on the
 * filename) stay attached. The stored order is applied on load, so a set the
 * user has never reordered keeps its natural order (no silent resort). The
 * order is saved immediately on each move - there is no separate Save action.
 *
 * Presentational + storage-reading: the actual delete is owned by the page's
 * ``useContentSetActions`` (passed in as ``onRequestDelete``).
 */

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../hooks/ui/useI18n";
import { lessonFilename } from "../../../lib/content/lesson/delete/delete-lesson";
import {
  applyStoredLessonOrder,
  moveLessonOrder,
  type MoveDirection,
} from "../../../lib/content/browse/lesson-order-store";
import { getStorage } from "../../../storage";
import type {
  BulkLessonDeleteTarget,
  LessonDeleteTarget,
} from "../../../hooks/content/useContentSetActions";
import type { ContentSetEntry } from "../../../storage/types";

interface LessonRow {
  filename: string;
  title: string;
}

export interface SetLessonListProps {
  entry: ContentSetEntry;
  /** Open one lesson of the set (by its cache filename). */
  onPlayLesson: (entry: ContentSetEntry, filename: string) => void;
  /** Edit one specific lesson of the set (#2210) - by its cache filename, so
   *  the wizard opens THAT lesson, never the set's first. */
  onEditLesson: (entry: ContentSetEntry, filename: string) => void;
  /** Ask the page to confirm+delete one lesson; ``onDeleted`` reloads this list. */
  onRequestDelete: (target: LessonDeleteTarget) => void;
  /** Ask the page to confirm+delete SEVERAL lessons at once (#2065); ``onDeleted``
   *  reloads this list and the caller clears the selection. */
  onRequestBulkDelete: (target: BulkLessonDeleteTarget) => void;
}

/** Reorder ``rows`` to match the stored display order for the set. */
function orderRows(
  rows: LessonRow[],
  source: string,
  setId: string,
): LessonRow[] {
  const filenames = rows.map((row) => row.filename);
  const orderedFilenames = applyStoredLessonOrder(filenames, source, setId);
  // No stored order -> the overlay returns the same reference: keep rows as-is.
  if (orderedFilenames === filenames) return rows;
  const byFilename = new Map(rows.map((row) => [row.filename, row]));
  return orderedFilenames
    .map((filename) => byFilename.get(filename))
    .filter((row): row is LessonRow => row !== undefined);
}

export default function SetLessonList({
  entry,
  onPlayLesson,
  onEditLesson,
  onRequestDelete,
  onRequestBulkDelete,
}: SetLessonListProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LessonRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // #2065 — multi-select delete mode: a Set of the currently checked filenames.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const toggleSelect = useCallback((filename: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const storage = getStorage();
      const listing = await storage.contentLoader.listLessons(entry.source, entry.id);
      const lessons = await Promise.all(
        listing.lessons.map((f) =>
          storage.contentLoader.getLesson(entry.source, entry.id, f),
        ),
      );
      const loaded = lessons.map((lesson) => ({
        filename: lessonFilename(lesson),
        title: lesson.title?.trim() || lessonFilename(lesson),
      }));
      setRows(orderRows(loaded, entry.source, entry.id));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [entry.source, entry.id]);

  useEffect(() => {
    if (open && rows === null) void load();
  }, [open, rows, load]);

  const move = useCallback(
    (row: LessonRow, direction: MoveDirection) => {
      setRows((current) => {
        if (!current) return current;
        const filenames = current.map((item) => item.filename);
        const next = moveLessonOrder(
          entry.source,
          entry.id,
          filenames,
          row.filename,
          direction,
        );
        if (next === filenames || next.every((f, i) => f === filenames[i])) {
          return current;
        }
        const byFilename = new Map(current.map((item) => [item.filename, item]));
        const reordered = next
          .map((filename) => byFilename.get(filename))
          .filter((item): item is LessonRow => item !== undefined);
        const position = reordered.findIndex((item) => item.filename === row.filename) + 1;
        setAnnouncement(
          t(
            "content.lesson_order.moved",
            "{title} is now at position {position} of {total}",
          )
            .replace("{title}", row.title)
            .replace("{position}", String(position))
            .replace("{total}", String(reordered.length)),
        );
        return reordered;
      });
    },
    [entry.source, entry.id, t],
  );

  const allFilenames = rows?.map((row) => row.filename) ?? [];
  const selectedCount = selected.size;
  const allSelected = allFilenames.length > 0 && selectedCount === allFilenames.length;

  const requestBulkDelete = useCallback(() => {
    if (selected.size === 0) return;
    onRequestBulkDelete({
      entry,
      filenames: [...selected],
      onDeleted: () => {
        exitSelectMode();
        void load();
      },
    });
  }, [selected, onRequestBulkDelete, entry, exitSelectMode, load]);

  return (
    <div className="mt-2" data-testid={`set-lessons-${entry.id}`}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-testid={`set-lessons-toggle-${entry.id}`}
      >
        {open ? (
          <ChevronDown size={14} aria-hidden="true" />
        ) : (
          <ChevronRight size={14} aria-hidden="true" />
        )}
        {t("content.lesson_delete.manage_lessons", "Manage lessons")}
      </Button>
      {open && rows && rows.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {!selectMode ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectMode(true)}
              data-testid={`set-lessons-select-toggle-${entry.id}`}
            >
              <ListChecks size={14} aria-hidden="true" />
              {t("content.lesson_delete.bulk_select", "Select lessons")}
            </Button>
          ) : (
            <div
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2"
              data-testid={`set-lessons-bulk-bar-${entry.id}`}
              role="group"
              aria-label={t("content.lesson_delete.bulk_bar_aria", "Bulk lesson actions")}
            >
              <span className="text-sm" aria-live="polite">
                {t("content.lesson_delete.bulk_selected", "{n} selected").replace(
                  "{n}",
                  String(selectedCount),
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelected(allSelected ? new Set() : new Set(allFilenames))
                }
                data-testid={`set-lessons-select-all-${entry.id}`}
              >
                {allSelected
                  ? t("content.lesson_delete.bulk_clear", "Clear selection")
                  : t("content.lesson_delete.bulk_select_all", "Select all")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={selectedCount === 0}
                onClick={requestBulkDelete}
                data-testid={`set-lessons-bulk-delete-${entry.id}`}
              >
                <Trash2 size={14} aria-hidden="true" />
                {t("content.lesson_delete.bulk_action_delete_n", "Delete {n}").replace(
                  "{n}",
                  String(selectedCount),
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={exitSelectMode}
                data-testid={`set-lessons-select-cancel-${entry.id}`}
              >
                {t("content.lesson_delete.bulk_cancel", "Cancel")}
              </Button>
            </div>
          )}
        </div>
      )}
      {open && (
        <ul
          className="mt-1 border-t border-border pt-1"
          data-testid={`set-lessons-list-${entry.id}`}
        >
          {loading && (
            <li className="py-1 text-sm text-muted-foreground">
              {t("common.loading", "Loading…")}
            </li>
          )}
          {rows?.map((row, index) => {
            const isFirst = index === 0;
            const isLast = index === rows.length - 1;
            if (selectMode) {
              return (
                <li
                  key={row.filename}
                  className="flex items-center gap-2 py-1"
                  data-testid={`set-lesson-${entry.id}-${row.filename}`}
                >
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.filename)}
                      onChange={() => toggleSelect(row.filename)}
                      data-testid={`set-lesson-select-${entry.id}-${row.filename}`}
                      aria-label={t(
                        "content.lesson_delete.bulk_select_aria",
                        "Select lesson {title}",
                      ).replace("{title}", row.title)}
                    />
                    <span className="min-w-0 truncate text-sm">{row.title}</span>
                  </label>
                </li>
              );
            }
            return (
              <li
                key={row.filename}
                className="flex items-center justify-between gap-2 py-1"
                data-testid={`set-lesson-${entry.id}-${row.filename}`}
              >
                <span className="min-w-0 truncate text-sm">{row.title}</span>
                <span className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isFirst}
                    onClick={() => move(row, "up")}
                    data-testid={`set-lesson-up-${entry.id}-${row.filename}`}
                    aria-label={
                      isFirst
                        ? t(
                            "content.lesson_order.already_first",
                            "{title} is already the first lesson",
                          ).replace("{title}", row.title)
                        : t(
                            "content.lesson_order.move_up",
                            "Move lesson {title} up",
                          ).replace("{title}", row.title)
                    }
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLast}
                    onClick={() => move(row, "down")}
                    data-testid={`set-lesson-down-${entry.id}-${row.filename}`}
                    aria-label={
                      isLast
                        ? t(
                            "content.lesson_order.already_last",
                            "{title} is already the last lesson",
                          ).replace("{title}", row.title)
                        : t(
                            "content.lesson_order.move_down",
                            "Move lesson {title} down",
                          ).replace("{title}", row.title)
                    }
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onPlayLesson(entry, row.filename)}
                    data-testid={`set-lesson-play-${entry.id}-${row.filename}`}
                    aria-label={t(
                      "content.lesson_delete.play_aria",
                      "Play lesson {title}",
                    ).replace("{title}", row.title)}
                  >
                    <Play size={14} aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onEditLesson(entry, row.filename)}
                    data-testid={`set-lesson-edit-${entry.id}-${row.filename}`}
                    aria-label={t(
                      "content.lesson_delete.edit_aria",
                      "Edit lesson {title}",
                    ).replace("{title}", row.title)}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      onRequestDelete({
                        entry,
                        filename: row.filename,
                        title: row.title,
                        onDeleted: load,
                      })
                    }
                    data-testid={`set-lesson-delete-${entry.id}-${row.filename}`}
                    aria-label={t(
                      "content.lesson_delete.delete_aria",
                      "Delete lesson {title}",
                    ).replace("{title}", row.title)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </Button>
                </span>
              </li>
            );
          })}
          {rows && rows.length === 0 && !loading && (
            <li className="py-1 text-sm text-muted-foreground">
              {t("content.warning.no_lessons_in_set", "This set has no lessons yet.")}
            </li>
          )}
        </ul>
      )}
      <div
        aria-live="polite"
        className="sr-only"
        data-testid={`set-lessons-announce-${entry.id}`}
      >
        {announcement}
      </div>
    </div>
  );
}
