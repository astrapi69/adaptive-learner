/**
 * Set-level action handlers for the /content page (extracted from
 * Content.tsx, #896).
 *
 * Owns the open / edit / delete / export / download handlers plus the
 * delete-confirm modal state. Every call routes through
 * ``getStorage().contentLoader.*`` so the same handlers work in API and
 * Dexie mode. Behaviour-preserving: the page wires these straight into
 * the toolbar, tree, and My-Lessons sections.
 *
 * Composed from one hook per concern (#3271, under ``./set-actions``):
 * deletion of sets and of lessons, lifecycle status, open/edit routing,
 * export, and download/update. The returned object is the same surface the
 * page has always consumed.
 *
 * @example
 * const actions = useContentSetActions({ navigate, setSets, setPerSetState });
 * actions.setDeleteSetTarget(entry);
 */

import type { NavigateFunction } from "react-router";

import type { ContentSetEntry } from "../../storage/types";
import {
  fetchSetLessons,
  useLessonDeletion,
  useSetDeletion,
  useSetDownload,
  useSetExport,
  useSetLifecycle,
  useSetNavigation,
} from "./set-actions";
import { useEditAsCopy } from "./useEditAsCopy";

export type { BulkLessonDeleteTarget, LessonDeleteTarget } from "./set-actions";

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
  const deletion = useSetDeletion({ setSets });
  const lessonDeletion = useLessonDeletion({ setSets });
  const lifecycle = useSetLifecycle({ setSets });
  const navigation = useSetNavigation({ navigate });
  const { handleExportJson, handleExportSet } = useSetExport();
  const download = useSetDownload({ setSets, setPerSetState });

  // EXP-046 item 3 / #2654 — "Als Kopie bearbeiten": fork a downloaded set
  // into a user-generated copy, then route into the editor exactly like
  // ``handleEditUserSet`` already does for "My Lessons".
  const {
    editAsCopyTarget,
    setEditAsCopyTarget,
    editingAsCopy,
    requestEditAsCopy,
    handleConfirmEditAsCopy,
  } = useEditAsCopy({ fetchSetLessons, onForked: navigation.handleEditUserSet });

  return {
    // #3001 — header "Aktualisieren": apply every pending update.
    updatingAll: download.updatingAll,
    handleUpdateAll: download.handleUpdateAll,
    // #2128 — held breaking-update confirmation.
    updateGuard: download.updateGuard,
    confirmUpdate: download.confirmUpdate,
    dismissUpdateGuard: download.dismissUpdateGuard,
    deleteTarget: deletion.deleteTarget,
    setDeleteTarget: deletion.setDeleteTarget,
    deleting: deletion.deleting,
    deleteSetTarget: deletion.deleteSetTarget,
    setDeleteSetTarget: deletion.setDeleteSetTarget,
    deletingSet: deletion.deletingSet,
    deleteSetPlan: deletion.deleteSetPlan,
    bulkDeletePlan: deletion.bulkDeletePlan,
    handleSetStatus: lifecycle.handleSetStatus,
    handleConfirmDeleteSet: deletion.handleConfirmDeleteSet,
    // EXP-051 / #2125 — "Set erneut durcharbeiten" (new Durchgang).
    restartSetTarget: lifecycle.restartSetTarget,
    setRestartSetTarget: lifecycle.setRestartSetTarget,
    restarting: lifecycle.restarting,
    requestRestartSet: lifecycle.requestRestartSet,
    handleConfirmRestartSet: lifecycle.handleConfirmRestartSet,
    // EXP-046 item 3 / #2654 — "Als Kopie bearbeiten" fork-then-edit.
    editAsCopyTarget,
    setEditAsCopyTarget,
    editingAsCopy,
    requestEditAsCopy,
    handleConfirmEditAsCopy,
    // #1351 — bulk multi-select actions.
    bulkDeleteTargets: deletion.bulkDeleteTargets,
    setBulkDeleteTargets: deletion.setBulkDeleteTargets,
    bulkDeleting: deletion.bulkDeleting,
    handleBulkSetStatus: lifecycle.handleBulkSetStatus,
    handleConfirmBulkDelete: deletion.handleConfirmBulkDelete,
    // #2064 — single-lesson delete.
    deleteLessonTarget: lessonDeletion.deleteLessonTarget,
    setDeleteLessonTarget: lessonDeletion.setDeleteLessonTarget,
    deletingLesson: lessonDeletion.deletingLesson,
    deleteLessonPlan: lessonDeletion.deleteLessonPlan,
    handleConfirmDeleteLesson: lessonDeletion.handleConfirmDeleteLesson,
    // #2065 — bulk multi-select lesson delete.
    bulkDeleteLessonsTarget: lessonDeletion.bulkDeleteLessonsTarget,
    setBulkDeleteLessonsTarget: lessonDeletion.setBulkDeleteLessonsTarget,
    bulkDeletingLessons: lessonDeletion.bulkDeletingLessons,
    bulkDeleteLessonsPlan: lessonDeletion.bulkDeleteLessonsPlan,
    handleConfirmBulkDeleteLessons: lessonDeletion.handleConfirmBulkDeleteLessons,
    openLessonFile: navigation.openLessonFile,
    handleOpenLesson: navigation.handleOpenLesson,
    handleEditUserSet: navigation.handleEditUserSet,
    handleDeleteUserSet: deletion.handleDeleteUserSet,
    handleExportJson,
    handleExportSet,
    fetchSetLessons,
    handleDownload: download.handleDownload,
  };
}
