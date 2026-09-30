/**
 * Set export for the /content page (Phase 59D), split out of
 * ``useContentSetActions`` (#3271): a single-lesson set downloads as one
 * lesson JSON, anything larger as the content-set ZIP.
 *
 * @example
 * const { handleExportJson, handleExportSet } = useSetExport();
 * await handleExportSet(entry); // always the ZIP
 */

import {
  buildContentSetZip,
  contentSetFileName,
  downloadLessonJson,
  triggerDownload,
  type ExportSetMeta,
} from "../../../lib/content/lesson/lesson-export";
import type { ContentSetEntry } from "../../../storage/types";
import { notify } from "../../../utils/notify";
import { useI18n } from "../../ui/useI18n";
import { fetchSetLessons } from "./set-entry";

/** The set metadata the export ZIP carries. */
const exportMeta = (entry: ContentSetEntry): ExportSetMeta => ({
  set_id: entry.id,
  title: entry.title,
  language: entry.language,
  target_language: entry.target_language,
  source_language: entry.source_language,
  level: entry.level,
  description: entry.description,
});

/** Export handlers for a set row. */
export function useSetExport() {
  const { t } = useI18n();

  const handleExportJson = async (entry: ContentSetEntry) => {
    try {
      const lessons = await fetchSetLessons(entry);
      if (lessons.length === 1) {
        downloadLessonJson(lessons[0]);
      } else {
        const blob = await buildContentSetZip(exportMeta(entry), lessons);
        triggerDownload(blob, contentSetFileName(entry.title));
      }
      notify.success(t("content.my_lessons.exported", "Lesson exported."));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(`${t("content.error.open_failed", "Could not open the lesson.")} ${detail}`);
    }
  };

  const handleExportSet = async (entry: ContentSetEntry) => {
    try {
      const lessons = await fetchSetLessons(entry);
      const blob = await buildContentSetZip(exportMeta(entry), lessons);
      triggerDownload(blob, contentSetFileName(entry.title));
      notify.success(t("content.my_lessons.exported", "Lesson exported."));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(`${t("content.error.open_failed", "Could not open the lesson.")} ${detail}`);
    }
  };

  return { handleExportJson, handleExportSet };
}
