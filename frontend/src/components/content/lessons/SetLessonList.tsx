/**
 * Expandable per-lesson list of a multi-lesson user-generated set (#2064).
 *
 * The "My Lessons" section shows one row per set; a book-text import (#1949)
 * stores many lessons in one set. This disclosure lets the user open a set and
 * delete an individual lesson (Play + Delete per lesson) - in the lesson LIST,
 * never the edit wizard (decision #4). Lessons load lazily on first expand and
 * reload after a delete (via the target's ``onDeleted`` callback).
 *
 * Presentational + storage-reading: the actual delete is owned by the page's
 * ``useContentSetActions`` (passed in as ``onRequestDelete``).
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../hooks/ui/useI18n";
import { lessonFilename } from "../../../lib/content/lesson/delete/delete-lesson";
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

export default function SetLessonList({
  entry,
  onPlayLesson,
  onRequestDelete,
}: SetLessonListProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LessonRow[] | null>(null);
  const [loading, setLoading] = useState(false);

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
      setRows(
        lessons.map((lesson) => ({
          filename: lessonFilename(lesson),
          title: lesson.title?.trim() || lessonFilename(lesson),
        })),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [entry.source, entry.id]);

  useEffect(() => {
    if (open && rows === null) void load();
  }, [open, rows, load]);

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
          {rows?.map((row) => (
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
          ))}
          {rows && rows.length === 0 && !loading && (
            <li className="py-1 text-sm text-muted-foreground">
              {t("content.warning.no_lessons_in_set", "This set has no lessons yet.")}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
