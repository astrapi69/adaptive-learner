/**
 * Expandable per-lesson list of a multi-lesson user-generated set (#2064).
 *
 * The "My Lessons" section shows one row per set; a book-text import (#1949)
 * stores many lessons in one set. This disclosure lets the user open a set,
 * reorder its lessons (#2172), and delete an individual lesson (Play + move
 * Up/Down + Delete per lesson) - in the lesson LIST, never the edit wizard
 * (decision #4). Lessons load lazily on first expand and reload after a delete
 * (via the target's ``onDeleted`` callback).
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
import type { LessonDeleteTarget } from "../../../hooks/content/useContentSetActions";
import type { ContentSetEntry } from "../../../storage/types";

interface LessonRow {
  filename: string;
  title: string;
}

export interface SetLessonListProps {
  entry: ContentSetEntry;
  /** Open one lesson of the set (by its cache filename). */
  onPlayLesson: (entry: ContentSetEntry, filename: string) => void;
  /** Ask the page to confirm+delete one lesson; ``onDeleted`` reloads this list. */
  onRequestDelete: (target: LessonDeleteTarget) => void;
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
  onRequestDelete,
}: SetLessonListProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LessonRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

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
                    aria-label={t("content.my_lessons.play", "Play")}
                  >
                    <Play size={14} aria-hidden="true" />
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
