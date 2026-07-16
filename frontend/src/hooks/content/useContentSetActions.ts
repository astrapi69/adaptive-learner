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
import {
  dismissSet,
  dismissSets,
  undismissSet,
} from "../../lib/content/browse/dismissed-sets";
import { getStorage } from "../../storage";
import type { ContentLesson, ContentSetEntry, SetStatus } from "../../storage/types";
import { useI18n } from "../ui/useI18n";
import { notify } from "../../utils/notify";

interface UseContentSetActionsDeps {
  navigate: NavigateFunction;
  /** Optimistic set-list mutation after a delete/download. */
  setSets: React.Dispatch<React.SetStateAction<ContentSetEntry[]>>;
  /** Per-set download status, owned by the data hook. */
  setPerSetState: React.Dispatch<
    React.SetStateAction<Record<string, import("../../components/content/browser/ContentSetRow").DownloadState>>
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
  // #1300 — downloaded-set delete-confirm modal target + status flow.
  const [deleteSetTarget, setDeleteSetTarget] = useState<ContentSetEntry | null>(null);
  const [deletingSet, setDeletingSet] = useState(false);
  // #1351 — multi-select bulk delete-confirm targets + in-flight flag.
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<ContentSetEntry[] | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const setKey = (entry: ContentSetEntry): string => `${entry.source}#${entry.id}`;

  // #1300 — move a downloaded set between lifecycle statuses. Optimistic:
  // the list updates immediately, then persists (Dexie row; API no-op).
  const handleSetStatus = async (entry: ContentSetEntry, status: SetStatus) => {
    setSets((prev) =>
      prev.map((row) =>
        row.source === entry.source && row.id === entry.id ? { ...row, status } : row,
      ),
    );
    try {
      await getStorage().contentLoader.setSetStatus(entry.source, entry.id, status);
      notify.success(t("content.set_status.changed", "Status updated."));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.set_status.change_failed", "Could not update the status.")} ${detail}`,
      );
    }
  };

  // #1300 — confirm-delete a downloaded set (purges the cached set + its
  // lessons from IndexedDB; learning progress is not touched).
  const handleConfirmDeleteSet = async () => {
    if (!deleteSetTarget) return;
    setDeletingSet(true);
    try {
      await getStorage().contentLoader.deleteSet(deleteSetTarget.source, deleteSetTarget.id);
      // #1709 — remember the explicit deletion so a Refresh (which re-reads
      // the source catalogue) does not restore the set into "Meine Inhalte".
      dismissSet(deleteSetTarget.source, deleteSetTarget.id);
      setSets((prev) =>
        prev.filter(
          (row) => !(row.source === deleteSetTarget.source && row.id === deleteSetTarget.id),
        ),
      );
      notify.success(t("content.set_status.deleted", "Set removed."));
      setDeleteSetTarget(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.set_status.delete_failed", "Could not remove the set.")} ${detail}`,
      );
    } finally {
      setDeletingSet(false);
    }
  };

  // #1351 — bulk status change over the selected sets. One batched storage
  // call (Dexie transaction), one optimistic list update. On success the
  // caller clears the selection; a short toast confirms.
  const handleBulkSetStatus = async (
    entries: ContentSetEntry[],
    status: SetStatus,
  ) => {
    if (entries.length === 0) return;
    const keys = new Set(entries.map(setKey));
    setSets((prev) =>
      prev.map((row) => (keys.has(setKey(row)) ? { ...row, status } : row)),
    );
    try {
      await getStorage().contentLoader.setSetsStatus(
        entries.map((e) => ({ source: e.source, setId: e.id })),
        status,
      );
      notify.success(
        t("content.set_status.bulk_changed", "Status updated for {n} sets.").replace(
          "{n}",
          String(entries.length),
        ),
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.set_status.change_failed", "Could not update the status.")} ${detail}`,
      );
    }
  };

  // #1351 — confirm-delete the selected sets. One batched Dexie transaction
  // (set rows + lessons); learning progress is untouched.
  const handleConfirmBulkDelete = async () => {
    const targets = bulkDeleteTargets;
    if (!targets || targets.length === 0) return;
    setBulkDeleting(true);
    const keys = new Set(targets.map(setKey));
    try {
      await getStorage().contentLoader.deleteSets(
        targets.map((e) => ({ source: e.source, setId: e.id })),
      );
      // #1709 — remember the explicit deletions so a Refresh (which re-reads
      // the source catalogue) does not restore the sets into "Meine Inhalte".
      dismissSets(targets.map((e) => ({ source: e.source, setId: e.id })));
      setSets((prev) => prev.filter((row) => !keys.has(setKey(row))));
      notify.success(
        t("content.set_status.bulk_deleted", "{n} sets removed.").replace(
          "{n}",
          String(targets.length),
        ),
      );
      setBulkDeleteTargets(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.set_status.delete_failed", "Could not remove the set.")} ${detail}`,
      );
    } finally {
      setBulkDeleting(false);
    }
  };

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

  // Edit a user-generated lesson. Analysis sets carry a recoverable
  // conversation id (``analysis-{convId}``), so they jump back to the
  // import page where re-analysing + re-saving overwrites in place
  // (Phase 59C). Every other own set (created / imported / adaptive)
  // opens the pre-filled Lesson Creator, which overwrites the same set
  // on save (#1740).
  const handleEditUserSet = (entry: ContentSetEntry) => {
    if (entry.domain === "analysis") {
      const convId = entry.id.replace(/^analysis-/, "");
      navigate(`/import/${encodeURIComponent(convId)}`);
      return;
    }
    navigate(
      `/create-lesson/edit/${encodeURIComponent(entry.source)}/${encodeURIComponent(entry.id)}`,
    );
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
      // #1709 — an explicit re-download revives a previously deleted set;
      // clear the stale dismissal record (the cached state wins anyway, this
      // just keeps the store tidy).
      undismissSet(entry.source, entry.id);
      setSets((prev) =>
        prev.map((row) => (row.source === entry.source && row.id === entry.id ? updated : row)),
      );
      setPerSetState((prev) => ({ ...prev, [key]: "done" }));
      // #1410 — click-through: this toast sits bottom-right over the lesson
      // footer's action button when the user opens the set right away
      // (fully covering it in landscape); passThrough keeps the button
      // tappable for the toast's whole lifetime.
      notify.success(
        t("content.toast.downloaded", "Set downloaded and ready to use."),
        { passThrough: true },
      );
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
    deleteSetTarget,
    setDeleteSetTarget,
    deletingSet,
    handleSetStatus,
    handleConfirmDeleteSet,
    // #1351 — bulk multi-select actions.
    bulkDeleteTargets,
    setBulkDeleteTargets,
    bulkDeleting,
    handleBulkSetStatus,
    handleConfirmBulkDelete,
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
