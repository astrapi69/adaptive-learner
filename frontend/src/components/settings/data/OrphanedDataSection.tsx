/**
 * OrphanedDataSection — Settings > Data cleanup for learner progress whose
 * content source is no longer connected (#1445 Part C).
 *
 * When a content repo is removed, its ``lessonProgress`` + ``elementErrors``
 * rows survive in Dexie (Part A hides them; the learner decides whether to
 * delete). This section surfaces the orphaned total with the REAL numbers
 * (live Dexie queries) and an explicit, irreversible delete — relevant on
 * devices under storage pressure (iOS evicts IndexedDB for space).
 *
 * Self-gating: renders NOTHING unless the store supports the local delete
 * (Dexie mode) AND orphaned data actually exists — no empty entry. Deletion
 * is atomic (one transaction) via ``learningData.deleteLearningData``.
 */

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../hooks/ui/useI18n";
import ConfirmDialog from "../../../shared/feedback/ConfirmDialog";
import {
  isEmptyPlan,
  planOrphanCleanup,
  type DeletionPlan,
} from "../../../lib/content/browse/orphan-cleanup";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { getStorage } from "../../../storage";
import { notify } from "../../../utils/notify";

export default function OrphanedDataSection() {
  const { t } = useI18n();
  const [plan, setPlan] = useState<DeletionPlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const userId = readLearnerState().userId;
    if (!userId) {
      setPlan(null);
      return;
    }
    try {
      const storage = getStorage();
      const [progress, cards, setsRes] = await Promise.all([
        storage.lessonProgress.list(userId),
        storage.elementErrors.list(userId, { includeMastered: true }),
        storage.contentLoader.listSets(),
      ]);
      setPlan(planOrphanCleanup(progress, cards, setsRes.sets));
    } catch {
      setPlan(null); // never invent a number; simply don't show the entry
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = useCallback(async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const userId = readLearnerState().userId;
      if (userId) {
        const { lessonsDeleted, cardsDeleted } =
          await getStorage().learningData.deleteLearningData(userId, {
            lessonProgressIds: plan.lessonProgressIds,
            setIds: plan.orphanedSetIds,
          });
        notify.success(
          t(
            "settings.orphaned.deleted",
            "Deleted {lessons} lessons and {cards} review cards.",
          )
            .replace("{lessons}", String(lessonsDeleted))
            .replace("{cards}", String(cardsDeleted)),
        );
      }
      setConfirming(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [plan, t, refresh]);

  // Only surface when there is genuinely orphaned data to clean up.
  if (!plan || isEmptyPlan(plan)) return null;

  return (
    <section
      className="settings-section"
      data-testid="settings-section-orphaned"
    >
      <h2 className="settings-section-title">
        {t("settings.orphaned.heading", "Disconnected content")}
      </h2>
      <p className="muted" data-testid="orphaned-summary">
        {t(
          "settings.orphaned.summary",
          "{lessons} lessons and {cards} review cards from sources you are no longer connected to.",
        )
          .replace("{lessons}", String(plan.lessonCount))
          .replace("{cards}", String(plan.cardCount))}
      </p>
      <Button
        type="button"
        variant="secondary"
        className="min-h-[44px] gap-2 self-start"
        onClick={() => setConfirming(true)}
        data-testid="orphaned-delete-button"
      >
        <Trash2 className="h-5 w-5" aria-hidden="true" />
        {t("settings.orphaned.delete", "Delete disconnected progress")}
      </Button>

      <ConfirmDialog
        open={confirming}
        title={t("settings.orphaned.confirm_title", "Delete disconnected progress")}
        message={t(
          "settings.orphaned.confirm_message",
          "{lessons} lessons and {cards} review cards will be permanently deleted. This cannot be undone.",
        )
          .replace("{lessons}", String(plan.lessonCount))
          .replace("{cards}", String(plan.cardCount))}
        variant="danger"
        confirmLabel={t("settings.orphaned.delete", "Delete disconnected progress")}
        cancelLabel={t("content_repo.action.cancel", "Cancel")}
        confirmDisabled={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
        testId="orphaned-confirm-dialog"
      />
    </section>
  );
}
