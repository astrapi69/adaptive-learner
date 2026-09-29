/**
 * Download and update of a set for the /content page, split out of
 * ``useContentSetActions`` (#3271): the per-set download path (#2130
 * stable-id migration, #2188 retirement archival, #2985 badge
 * invalidation), the #2128 update guard that holds a breaking update behind
 * a quantified confirmation (with the #2308 carry-over plan), and the #3001
 * "update every set" run composed from the same per-set path.
 *
 * @example
 * const download = useSetDownload({ setSets, setPerSetState });
 * await download.handleDownload(entry); // may open the update guard
 * await download.confirmUpdate(true);   // apply + carry progress over
 */

import { useState } from "react";

import { invalidateContentUpdateCount } from "../../../lib/content/browse/content-updates-badge";
import { undismissSet } from "../../../lib/content/browse/lifecycle/dismissed-sets";
import {
  assessSetUpdate,
  type SetUpdateAssessment,
} from "../../../lib/content/update/assess-set-update";
import { planSetUpdate, type SetUpdatePlan } from "../../../lib/content/update/plan-set-update";
import { migrateSetExerciseIds } from "../../../lib/content/update/stable-id-migration";
import type { UpdateImpact } from "../../../lib/content/update/update-impact";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { getStorage } from "../../../storage";
import type { ContentSetEntry } from "../../../storage/types";
import { notify } from "../../../utils/notify";
import { useI18n } from "../../ui/useI18n";
import { useUpdateAllSets } from "../update";
import { setKey } from "./set-entry";
import type { SetSetsDispatch } from "./types";

interface UseSetDownloadDeps {
  setSets: SetSetsDispatch;
  /** Per-set download status, owned by the data hook. */
  setPerSetState: React.Dispatch<
    React.SetStateAction<Record<string, import("../../../components/content/browser/ContentSetRow").DownloadState>>
  >;
}

/** A held breaking update awaiting the learner's decision (#2128). */
interface UpdateGuardState {
  entry: ContentSetEntry;
  impact: UpdateImpact;
  /** #2308 — the PROPOSED re-keying derived from the same peek. The plan is
   *  an inference, so it is carried into the dialog and applied only on the
   *  learner's explicit confirmation, never here. */
  plan: SetUpdatePlan;
  /** #2188 — declared retirements of the held incoming version; archived
   *  on confirm, after the download. */
  retiredIds: readonly string[];
}

/** Derive what COULD be carried over across a breaking update (#2308).
 *  A failed plan is not a failed guard: the dialog still holds the update,
 *  it just cannot offer to carry anything over. */
async function planCarryOver(
  entry: ContentSetEntry,
  assessment: SetUpdateAssessment,
): Promise<SetUpdatePlan> {
  try {
    return await planSetUpdate(
      entry.source,
      entry.id,
      assessment.impact,
      assessment.incomingLessons,
    );
  } catch {
    return {
      exercise: { certain: [], uncertain: [] },
      element: { certain: [], uncertain: [] },
    };
  }
}

/** Download/update handlers + the held-update guard for set rows. */
export function useSetDownload({ setSets, setPerSetState }: UseSetDownloadDeps) {
  const { t } = useI18n();
  const [updateGuard, setUpdateGuard] = useState<UpdateGuardState | null>(null);

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
      // #2308 — planning happens only on this manual path; the nightly sync
      // never computes it, so an inference can never be applied while nobody
      // is watching.
      const plan = await planCarryOver(entry, assessment);
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

  /** Download/update one set. ``quiet`` suppresses the per-set toasts so a
   *  bulk caller (#3001) can report one summary instead; returns whether
   *  the download succeeded. */
  const applyDownload = async (
    entry: ContentSetEntry,
    retiredIds: readonly string[] = [],
    quiet = false,
  ): Promise<boolean> => {
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
      // #2985 — the applied update lowers the header badge's count; drop
      // the session cache so the badge refreshes live instead of showing
      // the pre-update count until a full app reload.
      invalidateContentUpdateCount();
      setPerSetState((prev) => ({ ...prev, [key]: "done" }));
      // #1410 — click-through: this toast sits bottom-right over the lesson
      // footer's action button when the user opens the set right away
      // (fully covering it in landscape); passThrough keeps the button
      // tappable for the toast's whole lifetime.
      if (!quiet) {
        notify.success(
          t("content.toast.downloaded", "Set downloaded and ready to use."),
          { passThrough: true },
        );
      }
      return true;
    } catch (err) {
      setPerSetState((prev) => ({ ...prev, [key]: "error" }));
      if (!quiet) {
        notify.error(t("content.error.download_failed", "Could not download the set."), {
          apiError: err instanceof Error ? undefined : undefined,
        });
      }
      return false;
    }
  };

  // #3001 — header "Aktualisieren": apply every pending update in bulk.
  const { updatingAll, handleUpdateAll } = useUpdateAllSets({ applyDownload });

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
    const totalCertain =
      target.plan.exercise.certain.length + target.plan.element.certain.length;
    if (!carryOver || totalCertain === 0) return;
    const userId = readLearnerState().userId;
    if (!userId) return;
    try {
      const storage = getStorage();
      // AUTH-05 — exercise_id resolved first: the element-key plan's
      // proposed exercise_id already assumes the exercise remap has landed
      // (plan-set-update.ts), so applying out of order would look a row up
      // under an exercise_id storage does not have yet.
      const exerciseResult = await storage.elementErrors.remapExerciseIds(
        userId,
        target.plan.exercise.certain,
      );
      const elementResult = await storage.elementErrors.remapKeys(
        userId,
        target.plan.element.certain,
      );
      const applied = exerciseResult.applied + elementResult.applied;
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
    updatingAll,
    handleUpdateAll,
    updateGuard,
    confirmUpdate,
    dismissUpdateGuard,
    handleDownload,
  };
}
