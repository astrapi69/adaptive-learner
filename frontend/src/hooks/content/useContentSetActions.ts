/**
 * Set-level action handlers for the /content page (extracted from
 * Content.tsx, #896).
 *
 * Owns the open / edit / delete / export / download handlers plus the
 * delete-confirm modal state. Every call routes through
 * ``getStorage().contentLoader.*`` so the same handlers work in API and
 * Dexie mode. Behaviour-preserving: the page wires these straight into
 * the toolbar, tree, and My-Lessons sections.
 */

import { useState } from "react";
import type { NavigateFunction } from "react-router-dom";

import {
  buildContentSetZip,
  contentSetFileName,
  downloadLessonJson,
  triggerDownload,
  type ExportSetMeta,
} from "../../lib/content/lesson/lesson-export";
import { getStorage } from "../../storage";
import type { ContentLesson, ContentSetEntry } from "../../storage/types";
import { useI18n } from "../ui/useI18n";
import { notify } from "../../utils/notify";

interface UseContentSetActionsDeps {
  navigate: NavigateFunction;
  /** Optimistic set-list mutation after a delete/download. */
  setSets: React.Dispatch<React.SetStateAction<ContentSetEntry[]>>;
  /** Per-set download status, owned by the data hook. */
  setPerSetState: React.Dispatch<
    React.SetStateAction<Record<string, import("../../components/content/ContentSetRow").DownloadState>>
  >;
}

/** Action view-model returned to the /content page. */
export function useContentSetActions({
  navigate,
  setSets,
  setPerSetState,
}: UseContentSetActionsDeps) {
  const { t } = useI18n();
  // Phase 59C — My Lessons delete-confirm modal target.
  const [deleteTarget, setDeleteTarget] = useState<ContentSetEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const setKey = (entry: ContentSetEntry): string => `${entry.source}#${entry.id}`;

  /** Navigate to a specific lesson file (used by search results). */
  const openLessonFile = (source: string, id: string, filename: string) => {
    const slug = source.replace(/\//g, "--");
    navigate(
      `/lesson/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`,
    );
  };

  const handleOpenLesson = async (
    entry: ContentSetEntry,
    opts?: { focusResources?: boolean },
  ) => {
    // Phase 44 / EXP-002 / 3B: jump to the set's first
    // cached lesson. Future enhancements can swap this for
    // a dedicated per-set lesson list page.
    try {
      const listing = await getStorage().contentLoader.listLessons(entry.source, entry.id);
      const first = listing.lessons[0];
      if (!first) {
        notify.warning(t("content.warning.no_lessons_in_set", "This set has no lessons yet."));
        return;
      }
      const slug = entry.source.replace(/\//g, "--");
      // EXP-029 / MED-06 — a media-badge click deep-links to the
      // "Vertiefe das Thema" section (LessonResources scrolls to its
      // anchor when present).
      const hash = opts?.focusResources ? "#lesson-resources" : "";
      navigate(
        `/lesson/${encodeURIComponent(slug)}/${encodeURIComponent(entry.id)}/${encodeURIComponent(first)}${hash}`,
      );
    } catch (err) {
      notify.error(t("content.error.open_failed", "Could not open the lesson."), {
        apiError: err instanceof Error ? undefined : undefined,
      });
    }
  };

  // Phase 59C — edit a user-generated lesson: jump back to its
  // source conversation's import page, where re-saving overwrites
  // the set in place. Only analysis-sourced sets carry a
  // recoverable conversation id (set id is ``analysis-{convId}``).
  const handleEditUserSet = (entry: ContentSetEntry) => {
    const convId = entry.id.replace(/^analysis-/, "");
    navigate(`/import/${encodeURIComponent(convId)}`);
  };

  const handleDeleteUserSet = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await getStorage().contentLoader.deleteSet(deleteTarget.source, deleteTarget.id);
      setSets((prev) =>
        prev.filter((row) => !(row.source === deleteTarget.source && row.id === deleteTarget.id)),
      );
      notify.success(t("content.my_lessons.deleted", "Lesson deleted."));
      setDeleteTarget(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.my_lessons.delete_failed", "Could not delete the lesson.")} ${detail}`,
      );
    } finally {
      setDeleting(false);
    }
  };

  // Phase 59D — export + community sharing.
  const exportMeta = (entry: ContentSetEntry): ExportSetMeta => ({
    set_id: entry.id,
    title: entry.title,
    language: entry.language,
    level: entry.level,
    description: entry.description,
  });

  const fetchSetLessons = async (entry: ContentSetEntry): Promise<ContentLesson[]> => {
    const listing = await getStorage().contentLoader.listLessons(entry.source, entry.id);
    return Promise.all(
      listing.lessons.map((f) => getStorage().contentLoader.getLesson(entry.source, entry.id, f)),
    );
  };

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

  const handleDownload = async (entry: ContentSetEntry) => {
    const key = setKey(entry);
    setPerSetState((prev) => ({ ...prev, [key]: "downloading" }));
    try {
      const updated = await getStorage().contentLoader.downloadSet(entry.source, entry.id);
      setSets((prev) =>
        prev.map((row) => (row.source === entry.source && row.id === entry.id ? updated : row)),
      );
      setPerSetState((prev) => ({ ...prev, [key]: "done" }));
      notify.success(t("content.toast.downloaded", "Set downloaded and ready to use."));
    } catch (err) {
      setPerSetState((prev) => ({ ...prev, [key]: "error" }));
      notify.error(t("content.error.download_failed", "Could not download the set."), {
        apiError: err instanceof Error ? undefined : undefined,
      });
    }
  };

  return {
    deleteTarget,
    setDeleteTarget,
    deleting,
    openLessonFile,
    handleOpenLesson,
    handleEditUserSet,
    handleDeleteUserSet,
    handleExportJson,
    handleExportSet,
    fetchSetLessons,
    handleDownload,
  };
}
