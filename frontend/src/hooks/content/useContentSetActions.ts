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
import type { NavigateFunction } from "react-router";

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
import {
  storeSetStatus,
  storeSetStatuses,
} from "../../lib/content/browse/set-status-store";
import {
  isEmptyPlan,
  planLessonDataDeletion,
  planLessonsDataDeletion,
  planSetDataDeletion,
  type DeletionPlan,
} from "../../lib/content/browse/orphan-cleanup";
import {
  purgeLessonFromLessonCache,
  purgeSetFromLessonCache,
} from "../../lib/content/cache/sw-lesson-cache";
import {
  removeLessonFromSet,
  removeLessonsFromSet,
} from "../../lib/content/lesson/delete/delete-lesson";
import {
  assessSetUpdate,
  type SetUpdateAssessment,
} from "../../lib/content/update/assess-set-update";
import { planSetUpdate } from "../../lib/content/update/plan-set-update";
import type { RemapPlan } from "../../lib/content/update/remap-plan";
import type { UpdateImpact } from "../../lib/content/update/update-impact";
import { removeFavorite } from "../../lib/favorites/favorites";
import { readLearnerState } from "../../lib/learning/learnerState";
import { migrateSetExerciseIds } from "../../lib/content/update/stable-id-migration";
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

/** What a single-lesson delete targets (#2064): the set, the lesson's cache
 *  filename, a display title, and an optional callback to refresh the caller's
 *  per-lesson list after a successful delete. */
export interface LessonDeleteTarget {
  entry: ContentSetEntry;
  filename: string;
  title: string;
  onDeleted?: () => void;
}

/** What a bulk (multi-select) lesson delete targets (#2065): the set, the
 *  selected lessons' cache filenames, and an optional refresh callback. The
 *  whole selection is removed in one atomic re-save + one atomic learner-data
 *  delete (no per-lesson loop of writes). */
export interface BulkLessonDeleteTarget {
  entry: ContentSetEntry;
  filenames: string[];
  onDeleted?: () => void;
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
  const [deleteSetTarget, setDeleteSetTargetState] = useState<ContentSetEntry | null>(null);
  const [deletingSet, setDeletingSet] = useState(false);
  // #1819 — the "what gets deleted" plan for the opt-in progress delete
  // (null while counting / when no target; mirrors the repo-removal dialog).
  const [deleteSetPlan, setDeleteSetPlan] = useState<DeletionPlan | null>(null);
  // #1351 — multi-select bulk delete-confirm targets + in-flight flag.
  const [bulkDeleteTargets, setBulkDeleteTargetsState] = useState<ContentSetEntry[] | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeletePlan, setBulkDeletePlan] = useState<DeletionPlan | null>(null);
  // #2064 — single-lesson delete-confirm modal target (the set + the lesson
  // filename + a display title) + in-flight flag + learner-data plan.
  const [deleteLessonTarget, setDeleteLessonTargetState] =
    useState<LessonDeleteTarget | null>(null);
  const [deletingLesson, setDeletingLesson] = useState(false);
  const [deleteLessonPlan, setDeleteLessonPlan] = useState<DeletionPlan | null>(null);
  // #2065 — bulk multi-select lesson delete-confirm target + in-flight flag +
  // aggregated learner-data plan across the selected lessons.
  const [bulkDeleteLessonsTarget, setBulkDeleteLessonsTargetState] =
    useState<BulkLessonDeleteTarget | null>(null);
  const [bulkDeletingLessons, setBulkDeletingLessons] = useState(false);
  const [bulkDeleteLessonsPlan, setBulkDeleteLessonsPlan] =
    useState<DeletionPlan | null>(null);

  // #2128 — a held breaking update awaiting the learner's decision.
  // #2308 — plus the PROPOSED re-keying derived from the same peek. The plan
  // is an inference, so it is carried into the dialog and applied only on the
  // learner's explicit confirmation, never here.
  const [updateGuard, setUpdateGuard] = useState<{
    entry: ContentSetEntry;
    impact: UpdateImpact;
    plan: RemapPlan;
    /** #2188 — declared retirements of the held incoming version; archived
     *  on confirm, after the download. */
    retiredIds: readonly string[];
  } | null>(null);

  const setKey = (entry: ContentSetEntry): string => `${entry.source}#${entry.id}`;

  /** Plan the learner-data deletion for one or more sets (#1819). Counts
   *  come from live storage reads, never estimates; null on failure so the
   *  dialog shows the checkbox without a number. */
  const computeDeletionPlan = async (
    entries: readonly ContentSetEntry[],
  ): Promise<DeletionPlan | null> => {
    const userId = readLearnerState().userId;
    if (!userId) return null;
    try {
      const storage = getStorage();
      const [progress, cards, setsRes] = await Promise.all([
        storage.lessonProgress.list(userId),
        storage.elementErrors.list(userId, { includeMastered: true }),
        storage.contentLoader.listSets(),
      ]);
      const merged: DeletionPlan = {
        lessonProgressIds: [],
        orphanedSetIds: [],
        lessonCount: 0,
        cardCount: 0,
      };
      for (const entry of entries) {
        const plan = planSetDataDeletion(
          entry.source,
          entry.id,
          progress,
          cards,
          setsRes.sets,
        );
        merged.lessonProgressIds.push(...plan.lessonProgressIds);
        merged.orphanedSetIds.push(...plan.orphanedSetIds);
        merged.lessonCount += plan.lessonCount;
        merged.cardCount += plan.cardCount;
      }
      return merged;
    } catch {
      return null;
    }
  };

  const setDeleteSetTarget = (entry: ContentSetEntry | null) => {
    setDeleteSetTargetState(entry);
    setDeleteSetPlan(null);
    if (entry) void computeDeletionPlan([entry]).then(setDeleteSetPlan);
  };

  const setBulkDeleteTargets = (entries: ContentSetEntry[] | null) => {
    setBulkDeleteTargetsState(entries);
    setBulkDeletePlan(null);
    if (entries && entries.length > 0) {
      void computeDeletionPlan(entries).then(setBulkDeletePlan);
    }
  };

  /** Plan the learner-data deletion for ONE lesson (#2064). Counts come from
   *  live storage reads; null on failure so the dialog shows the checkbox
   *  without a number. */
  const computeLessonDeletionPlan = async (
    target: LessonDeleteTarget,
  ): Promise<DeletionPlan | null> => {
    const userId = readLearnerState().userId;
    if (!userId) return null;
    try {
      const storage = getStorage();
      const [progress, cards] = await Promise.all([
        storage.lessonProgress.list(userId),
        storage.elementErrors.list(userId, { includeMastered: true }),
      ]);
      return planLessonDataDeletion(
        target.entry.source,
        target.entry.id,
        target.filename,
        progress,
        cards,
      );
    } catch {
      return null;
    }
  };

  const setDeleteLessonTarget = (target: LessonDeleteTarget | null) => {
    setDeleteLessonTargetState(target);
    setDeleteLessonPlan(null);
    if (target) void computeLessonDeletionPlan(target).then(setDeleteLessonPlan);
  };

  /** Plan the aggregated learner-data deletion for SEVERAL lessons of one set
   *  (#2065). One live read, one merged plan; null on failure so the dialog
   *  shows the checkbox without a number. */
  const computeLessonsDeletionPlan = async (
    target: BulkLessonDeleteTarget,
  ): Promise<DeletionPlan | null> => {
    const userId = readLearnerState().userId;
    if (!userId) return null;
    try {
      const storage = getStorage();
      const [progress, cards] = await Promise.all([
        storage.lessonProgress.list(userId),
        storage.elementErrors.list(userId, { includeMastered: true }),
      ]);
      return planLessonsDataDeletion(
        target.entry.source,
        target.entry.id,
        target.filenames,
        progress,
        cards,
      );
    } catch {
      return null;
    }
  };

  const setBulkDeleteLessonsTarget = (target: BulkLessonDeleteTarget | null) => {
    setBulkDeleteLessonsTargetState(target);
    setBulkDeleteLessonsPlan(null);
    if (target && target.filenames.length > 0) {
      void computeLessonsDeletionPlan(target).then(setBulkDeleteLessonsPlan);
    }
  };

  /** Delete the planned learner data after the cache delete (#1819).
   *  Opt-in only; an empty/unknown plan is a no-op. */
  const deletePlannedLearnerData = async (plan: DeletionPlan | null) => {
    const userId = readLearnerState().userId;
    if (!userId || !plan || isEmptyPlan(plan)) return;
    await getStorage().learningData.deleteLearningData(userId, {
      lessonProgressIds: plan.lessonProgressIds,
      setIds: plan.orphanedSetIds,
      lessonCards: plan.lessonCards,
    });
  };

  // #1300 — move a downloaded set between lifecycle statuses. Optimistic:
  // the list updates immediately, then persists to the mode-agnostic
  // set-status store (single source of truth in BOTH storage modes — the
  // prior Dexie-row-only persistence left API mode a no-op, so the status
  // reverted to "active" on every reload).
  const handleSetStatus = (entry: ContentSetEntry, status: SetStatus) => {
    setSets((prev) =>
      prev.map((row) =>
        row.source === entry.source && row.id === entry.id ? { ...row, status } : row,
      ),
    );
    storeSetStatus(entry.source, entry.id, status);
    notify.success(t("content.set_status.changed", "Status updated."));
  };

  // #1300 — confirm-delete a downloaded set (purges the cached set + its
  // lessons from the local cache AND the SW lesson cache; learning progress
  // is deleted only via the opt-in checkbox, #1819).
  const handleConfirmDeleteSet = async (deleteProgress = false) => {
    if (!deleteSetTarget) return;
    setDeletingSet(true);
    try {
      await getStorage().contentLoader.deleteSet(deleteSetTarget.source, deleteSetTarget.id);
      await purgeSetFromLessonCache(deleteSetTarget.source, deleteSetTarget.id);
      if (deleteProgress) await deletePlannedLearnerData(deleteSetPlan);
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

  // #1351 — bulk status change over the selected sets. One optimistic list
  // update + one write to the mode-agnostic set-status store (single source
  // of truth in BOTH storage modes). On success the caller clears the
  // selection; a short toast confirms.
  const handleBulkSetStatus = (
    entries: ContentSetEntry[],
    status: SetStatus,
  ) => {
    if (entries.length === 0) return;
    const keys = new Set(entries.map(setKey));
    setSets((prev) =>
      prev.map((row) => (keys.has(setKey(row)) ? { ...row, status } : row)),
    );
    storeSetStatuses(
      entries.map((e) => ({ source: e.source, setId: e.id })),
      status,
    );
    notify.success(
      t("content.set_status.bulk_changed", "Status updated for {n} sets.").replace(
        "{n}",
        String(entries.length),
      ),
    );
  };

  // #1351 — confirm-delete the selected sets. One batched Dexie transaction
  // (set rows + lessons) + SW-cache purge; learning progress is deleted only
  // via the opt-in checkbox (#1819).
  const handleConfirmBulkDelete = async (deleteProgress = false) => {
    const targets = bulkDeleteTargets;
    if (!targets || targets.length === 0) return;
    setBulkDeleting(true);
    const keys = new Set(targets.map(setKey));
    try {
      await getStorage().contentLoader.deleteSets(
        targets.map((e) => ({ source: e.source, setId: e.id })),
      );
      for (const entry of targets) {
        await purgeSetFromLessonCache(entry.source, entry.id);
      }
      if (deleteProgress) await deletePlannedLearnerData(bulkDeletePlan);
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

  // #2064 — confirm-delete ONE lesson of a user-generated set. The lesson
  // content is always removed (re-save the set without it, or delete the whole
  // set when it was the last lesson); its SW-cache entry + orphaned favorite
  // are purged unconditionally; learning progress + review cards are deleted
  // only via the opt-in checkbox.
  const handleConfirmDeleteLesson = async (deleteProgress = false) => {
    const target = deleteLessonTarget;
    if (!target) return;
    const { entry, filename } = target;
    setDeletingLesson(true);
    try {
      const lessons = await fetchSetLessons(entry);
      const removal = removeLessonFromSet(entry, lessons, filename);
      if (!removal.found) {
        // Already gone (stale UI): treat as success and let the caller refresh.
        notify.success(t("content.lesson_delete.deleted", "Lesson deleted."));
        target.onDeleted?.();
        setDeleteLessonTarget(null);
        return;
      }
      if (removal.input === null) {
        // The last lesson — remove the whole set (same purge as a set delete).
        await getStorage().contentLoader.deleteSet(entry.source, entry.id);
        await purgeSetFromLessonCache(entry.source, entry.id);
        dismissSet(entry.source, entry.id);
        setSets((prev) =>
          prev.filter((row) => !(row.source === entry.source && row.id === entry.id)),
        );
      } else {
        // Re-save the set without the lesson (saveUserSet purges + rewrites the
        // cache atomically; siblings keep their ids — no renumbering).
        await getStorage().contentLoader.saveUserSet(removal.input);
        await purgeLessonFromLessonCache(entry.source, entry.id, filename);
        setSets((prev) =>
          prev.map((row) =>
            row.source === entry.source && row.id === entry.id
              ? { ...row, lesson_count: removal.remaining }
              : row,
          ),
        );
      }
      // A deleted lesson's favorite bookmark is now an orphan — always remove
      // it, regardless of the progress opt-in.
      const userId = readLearnerState().userId;
      if (userId) removeFavorite(userId, entry.id, filename);
      if (deleteProgress) await deletePlannedLearnerData(deleteLessonPlan);
      notify.success(t("content.lesson_delete.deleted", "Lesson deleted."));
      target.onDeleted?.();
      setDeleteLessonTarget(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.lesson_delete.delete_failed", "Could not delete the lesson.")} ${detail}`,
      );
    } finally {
      setDeletingLesson(false);
    }
  };

  // #2065 — confirm-delete SEVERAL lessons of a user-generated set in one
  // atomic operation. All-or-nothing for the content: a single ``saveUserSet``
  // re-save without the whole selection (or one ``deleteSet`` when the
  // selection empties the set), so a failure leaves the set untouched — never a
  // half-deleted state. Learner data is one aggregated, atomic
  // ``deleteLearningData`` call, opt-in only. Orphaned favorites of every
  // deleted lesson are purged unconditionally.
  const handleConfirmBulkDeleteLessons = async (deleteProgress = false) => {
    const target = bulkDeleteLessonsTarget;
    if (!target || target.filenames.length === 0) return;
    const { entry, filenames } = target;
    setBulkDeletingLessons(true);
    try {
      const lessons = await fetchSetLessons(entry);
      const removal = removeLessonsFromSet(entry, lessons, filenames);
      if (removal.found.length === 0) {
        // Every selected lesson is already gone (stale UI): treat as success
        // and let the caller refresh.
        notify.success(t("content.lesson_delete.deleted", "Lesson deleted."));
        target.onDeleted?.();
        setBulkDeleteLessonsTarget(null);
        return;
      }
      if (removal.emptied) {
        // The selection covered every lesson — remove the whole set (same purge
        // as a set delete), leaving no empty husk behind.
        await getStorage().contentLoader.deleteSet(entry.source, entry.id);
        await purgeSetFromLessonCache(entry.source, entry.id);
        dismissSet(entry.source, entry.id);
        setSets((prev) =>
          prev.filter((row) => !(row.source === entry.source && row.id === entry.id)),
        );
      } else {
        // One atomic re-save without the whole selection (saveUserSet purges +
        // rewrites the cache in one write; survivors keep their ids/order).
        await getStorage().contentLoader.saveUserSet(removal.input!);
        for (const filename of removal.found) {
          await purgeLessonFromLessonCache(entry.source, entry.id, filename);
        }
        setSets((prev) =>
          prev.map((row) =>
            row.source === entry.source && row.id === entry.id
              ? { ...row, lesson_count: removal.remaining }
              : row,
          ),
        );
      }
      // Every deleted lesson's favorite bookmark is now an orphan — always
      // remove it, regardless of the progress opt-in.
      const userId = readLearnerState().userId;
      if (userId) {
        for (const filename of removal.found) removeFavorite(userId, entry.id, filename);
      }
      if (deleteProgress) await deletePlannedLearnerData(bulkDeleteLessonsPlan);
      notify.success(
        t("content.lesson_delete.bulk_deleted", "{n} lessons deleted.").replace(
          "{n}",
          String(removal.found.length),
        ),
      );
      target.onDeleted?.();
      setBulkDeleteLessonsTarget(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.lesson_delete.bulk_delete_failed", "Could not delete the lessons.")} ${detail}`,
      );
    } finally {
      setBulkDeletingLessons(false);
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
  const handleEditUserSet = (entry: ContentSetEntry, lessonFilename?: string) => {
    if (entry.domain === "analysis") {
      const convId = entry.id.replace(/^analysis-/, "");
      navigate(`/import/${encodeURIComponent(convId)}`);
      return;
    }
    // #2210 — a per-row Edit aims the wizard at one specific lesson via
    // ?lesson=; the set-level Edit (single-lesson sets) passes none and
    // keeps the historical "first lesson" landing.
    const base = `/create-lesson/edit/${encodeURIComponent(entry.source)}/${encodeURIComponent(entry.id)}`;
    navigate(
      lessonFilename ? `${base}?lesson=${encodeURIComponent(lessonFilename)}` : base,
    );
  };

  const handleDeleteUserSet = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await getStorage().contentLoader.deleteSet(deleteTarget.source, deleteTarget.id);
      await purgeSetFromLessonCache(deleteTarget.source, deleteTarget.id);
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

  // #2128 — when a manual "Update" of a set the learner is studying would
  // orphan progress/SRS, hold it behind a quantified confirmation instead of
  // overwriting silently. First downloads (no progress) and harmless updates
  // pass straight through; a peek failure does NOT trap a user-initiated
  // update (auto-sync holds on failure, the deliberate manual path proceeds).
  const handleDownload = async (entry: ContentSetEntry) => {
    let assessment: SetUpdateAssessment | null;
    try {
      assessment = await assessSetUpdate(entry.source, entry.id);
    } catch {
      assessment = null;
    }
    if (assessment?.impact.breaking) {
      // #2308 — derive what COULD be carried over. Planning happens only on
      // this manual path; the nightly sync never computes it, so an inference
      // can never be applied while nobody is watching.
      let plan: RemapPlan = { certain: [], uncertain: [] };
      try {
        plan = await planSetUpdate(
          entry.source,
          entry.id,
          assessment.impact,
          assessment.incomingLessons,
        );
      } catch {
        // A failed plan is not a failed guard: the dialog still holds the
        // update, it just cannot offer to carry anything over.
      }
      setUpdateGuard({
        entry,
        impact: assessment.impact,
        plan,
        retiredIds: assessment.retiredIds,
      });
      return;
    }
    await applyDownload(entry, assessment?.retiredIds ?? []);
  };

  // #2188 — after a successful download whose incoming manifest declared
  // retirements, archive the matching learner rows (history kept, out of
  // scheduling) and tell the learner ONCE, with the count.
  const archiveRetiredAfterDownload = async (
    entry: ContentSetEntry,
    retiredIds: readonly string[],
  ) => {
    if (retiredIds.length === 0) return;
    const userId = readLearnerState().userId;
    if (!userId) return;
    try {
      const { archived } = await getStorage().elementErrors.archiveRetired(
        userId,
        entry.id,
        retiredIds,
      );
      if (archived > 0) {
        notify.info(
          t(
            "content.update_guard.retired_archived",
            "{count} exercises were retired by the author; the related progress is archived.",
          ).replace("{count}", String(archived)),
        );
      }
    } catch {
      // Archival is repeatable; the next download/sync retries.
    }
  };

  const applyDownload = async (entry: ContentSetEntry, retiredIds: readonly string[] = []) => {
    const key = setKey(entry);
    setPerSetState((prev) => ({ ...prev, [key]: "downloading" }));
    try {
      const updated = await getStorage().contentLoader.downloadSet(entry.source, entry.id);
      // #2130 — re-key this set's rows onto stable_id now that the freshly
      // downloaded lessons carry the mapping. Idempotent; best-effort — a
      // failure leaves the rows on their current key and the next
      // download/sync retries.
      const learnerId = readLearnerState().userId;
      if (learnerId) {
        // #2130 migration first, so archival (#2188) meets stable-keyed rows.
        await migrateSetExerciseIds(learnerId, entry.source, entry.id).catch(
          () => undefined,
        );
      }
      await archiveRetiredAfterDownload(entry, retiredIds);
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

  // #2128 — the learner confirmed a held update: apply it now.
  // #2308 — ``carryOver`` re-keys the rows the plan could assign with
  // confidence. The content is downloaded FIRST: if the re-key then fails, the
  // learner is left in exactly today's state (rows orphaned) rather than in a
  // new one (rows pointing at keys no version has). The re-key itself is
  // atomic and idempotent, so a retry is safe.
  const confirmUpdate = async (carryOver = false) => {
    const target = updateGuard;
    setUpdateGuard(null);
    if (!target) return;
    await applyDownload(target.entry, target.retiredIds);
    if (!carryOver || target.plan.certain.length === 0) return;
    const userId = readLearnerState().userId;
    if (!userId) return;
    try {
      const { applied } = await getStorage().elementErrors.remapKeys(
        userId,
        target.plan.certain,
      );
      notify.success(
        `${t("content.update_guard.carried_over", "Progress carried over.")} (${applied})`,
      );
    } catch {
      notify.error(
        t(
          "content.update_guard.carry_over_failed",
          "The update was applied, but the progress could not be carried over.",
        ),
      );
    }
  };
  const dismissUpdateGuard = () => setUpdateGuard(null);

  return {
    // #2128 — held breaking-update confirmation.
    updateGuard,
    confirmUpdate,
    dismissUpdateGuard,
    deleteTarget,
    setDeleteTarget,
    deleting,
    deleteSetTarget,
    setDeleteSetTarget,
    deletingSet,
    deleteSetPlan,
    bulkDeletePlan,
    handleSetStatus,
    handleConfirmDeleteSet,
    // #1351 — bulk multi-select actions.
    bulkDeleteTargets,
    setBulkDeleteTargets,
    bulkDeleting,
    handleBulkSetStatus,
    handleConfirmBulkDelete,
    // #2064 — single-lesson delete.
    deleteLessonTarget,
    setDeleteLessonTarget,
    deletingLesson,
    deleteLessonPlan,
    handleConfirmDeleteLesson,
    // #2065 — bulk multi-select lesson delete.
    bulkDeleteLessonsTarget,
    setBulkDeleteLessonsTarget,
    bulkDeletingLessons,
    bulkDeleteLessonsPlan,
    handleConfirmBulkDeleteLessons,
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
