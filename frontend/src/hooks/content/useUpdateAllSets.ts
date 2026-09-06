/**
 * useUpdateAllSets (#3001) — the header "Aktualisieren" on Meine Inhalte
 * applies EVERY set update the freshly reloaded list reports, not one per
 * row. It composes the per-set download path the row button uses (handed
 * in as ``applyDownload``, so #2130 migration, #2188 archival and the #2985
 * badge invalidation ride along) with the #2128 identity guard: a breaking
 * update is never applied unseen, it is skipped here and confirmed per row.
 *
 * Sequential on purpose: the peek + download per set is the expensive part
 * and a parallel burst trips the source's rate limit (#1441). One summary
 * toast per outcome class instead of one toast per set.
 *
 * @example
 * const { updatingAll, handleUpdateAll } = useUpdateAllSets({ applyDownload });
 * await handleUpdateAll(freshSets); // applies every update_available set
 */

import { useState } from "react";

import {
  assessSetUpdate,
  type SetUpdateAssessment,
} from "../../lib/content/update/assess-set-update";
import type { ContentSetEntry } from "../../storage/types";
import { useI18n } from "../ui/useI18n";
import { notify } from "../../utils/notify";

type UpdateOutcome = "applied" | "held" | "failed";
type OutcomeCounts = Record<UpdateOutcome, number>;

interface UseUpdateAllSetsDeps {
  /** The per-set download/update path; ``quiet`` suppresses its own toasts. */
  applyDownload: (
    entry: ContentSetEntry,
    retiredIds: readonly string[],
    quiet: boolean,
  ) => Promise<boolean>;
}

export function useUpdateAllSets({ applyDownload }: UseUpdateAllSetsDeps) {
  const { t } = useI18n();
  const [updatingAll, setUpdatingAll] = useState(false);

  const updateOne = async (entry: ContentSetEntry): Promise<UpdateOutcome> => {
    let assessment: SetUpdateAssessment | null;
    try {
      assessment = await assessSetUpdate(entry.source, entry.id);
    } catch {
      assessment = null;
    }
    if (assessment?.impact.breaking) return "held";
    const ok = await applyDownload(entry, assessment?.retiredIds ?? [], true);
    return ok ? "applied" : "failed";
  };

  const report = (counts: OutcomeCounts) => {
    const withCount = (key: string, fallback: string, n: number) =>
      t(key, fallback).replace("{n}", String(n));
    if (counts.applied > 0) {
      notify.success(
        withCount("content.toast.updated_all", "{n} sets updated.", counts.applied),
        { passThrough: true },
      );
    }
    if (counts.held > 0) {
      notify.info(
        withCount(
          "content.toast.updates_held",
          "{n} updates were held back because they would affect your progress. Confirm each one with its Update button.",
          counts.held,
        ),
      );
    }
    if (counts.failed > 0) {
      notify.error(
        withCount("content.error.update_all_failed", "{n} updates failed.", counts.failed),
      );
    }
  };

  const handleUpdateAll = async (entries: readonly ContentSetEntry[]) => {
    const pending = entries.filter((entry) => entry.update_available);
    if (pending.length === 0) {
      notify.info(t("content.toast.all_up_to_date", "All sets are up to date."));
      return;
    }
    const counts: OutcomeCounts = { applied: 0, held: 0, failed: 0 };
    setUpdatingAll(true);
    try {
      for (const entry of pending) counts[await updateOne(entry)] += 1;
    } finally {
      setUpdatingAll(false);
    }
    report(counts);
  };

  return { updatingAll, handleUpdateAll };
}
