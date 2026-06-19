import { useState } from "react";

import { useI18n } from "../../hooks/ui/useI18n";
import { snapshotAdaptiveLesson } from "../../lib/content/adaptive-snapshot";
import { readLearnerState } from "../../lib/learnerState";
import { getStorage } from "../../storage";
import type { ContentLesson } from "../../storage/types";
import { notify } from "../../utils/notify";

interface SaveAdaptiveLessonButtonProps {
  /** The live adaptive lesson to snapshot + save. */
  lesson: ContentLesson;
}

/**
 * Phase 59F / v1.42.0 — after completing an adaptive lesson, offer to
 * save it as a replayable offline lesson (origin "adaptive"). The
 * lesson is snapshotted (slug-safe ids, self-contained exercises) so
 * it stays playable even if the adaptive generator changes later.
 */
export default function SaveAdaptiveLessonButton({
  lesson,
}: SaveAdaptiveLessonButtonProps) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const snapshot = snapshotAdaptiveLesson(lesson);
      await getStorage().contentLoader.saveUserSet({
        set_id: snapshot.id,
        title: lesson.title,
        language: readLearnerState().language ?? "en",
        level: "adaptive",
        origin: "adaptive",
        description: lesson.description,
        lessons: [snapshot],
      });
      setSaved(true);
      notify.success(t("content.save_lesson.saved", "Saved to My Lessons."));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.save_lesson.failed", "Could not save the lesson.")} ${detail}`,
      );
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <p className="form-hint" data-testid="adaptive-save-done">
        {t("content.save_lesson.saved", "Saved to My Lessons.")}
      </p>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-secondary"
      data-testid="adaptive-save-lesson"
      onClick={save}
      disabled={saving}
    >
      {saving
        ? t("common.loading", "Loading…")
        : t("content.save_adaptive.button", "Save this lesson?")}
    </button>
  );
}
