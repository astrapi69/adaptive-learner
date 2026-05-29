import { useState } from "react";

import { useI18n } from "../../hooks/useI18n";
import {
  generateLessonFromAnalysis,
  slugify,
  summarizeGeneratedLesson,
  type AnalysisLessonLabels,
} from "../../lib/content/analysis-to-lesson";
import { getStorage } from "../../storage";
import type { ContentSetEntry } from "../../storage/types";
import type { ConversationAnalysisResult } from "../../types/domain";
import { notify } from "../../utils/notify";

interface SaveOfflineLessonModalProps {
  open: boolean;
  analysis: ConversationAnalysisResult;
  /** Stable id for the synthetic set (the conversation id). */
  conversationId: string;
  conversationTitle: string;
  /** Content language for the saved set (BCP47-ish). */
  language: string;
  onCancel: () => void;
  onSaved: (entry: ContentSetEntry) => void;
}

/**
 * Phase 59B / v1.42.0 — preview + save a chat analysis as an offline
 * lesson. Generates the lesson (deterministic, offline), shows a
 * structure preview (exercise count, theory steps, est. time), lets
 * the user edit the title, then persists it as a user-generated set
 * via ``getStorage().contentLoader.saveUserSet`` (works in both
 * storage modes). Empty / tiny analyses produce a theory-only study
 * guide with an explanatory note.
 */
export default function SaveOfflineLessonModal({
  open,
  analysis,
  conversationId,
  conversationTitle,
  language,
  onCancel,
  onSaved,
}: SaveOfflineLessonModalProps) {
  const { t } = useI18n();

  const labels: AnalysisLessonLabels = {
    fallbackTitle: t("content.lesson_gen.fallback_title", "Imported lesson"),
    focusLabel: t("content.lesson_gen.focus", "Focus"),
    topicsTitle: t("content.lesson_gen.topics", "Topics"),
    strengthsTitle: t("content.lesson_gen.strengths", "What you already know"),
    weaknessesTitle: t("content.lesson_gen.weaknesses", "What we will work on"),
    errorPatternsTitle: t("content.lesson_gen.errors", "Common mistakes"),
    matchingPrompt: t(
      "content.lesson_gen.match_prompt",
      "Match each word with its translation.",
    ),
    freeTextPrompt: t("content.lesson_gen.free_prompt", "Translate: {word}"),
    clozePrompt: t(
      "content.lesson_gen.cloze_prompt",
      "Fill in the missing word.",
    ),
    wordTilesPrompt: t(
      "content.lesson_gen.tiles_prompt",
      "Arrange the words into the sentence ({word}).",
    ),
  };

  const setId = `analysis-${slugify(conversationId)}`;
  const baseLesson = generateLessonFromAnalysis(analysis, {
    id: setId,
    labels,
  });
  const summary = summarizeGeneratedLesson(baseLesson);

  const [title, setTitle] = useState(baseLesson.title || conversationTitle);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function save() {
    setSaving(true);
    try {
      const finalTitle = title.trim() || baseLesson.title;
      const lesson = { ...baseLesson, title: finalTitle };
      const entry = await getStorage().contentLoader.saveUserSet({
        set_id: setId,
        title: finalTitle,
        language: language || "en",
        level: analysis.user_level ?? "beginner",
        origin: "analysis",
        description: baseLesson.description,
        lessons: [lesson],
      });
      notify.success(t("content.save_lesson.saved", "Saved to My Lessons."));
      onSaved(entry);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.save_lesson.failed", "Could not save the lesson.")} ${detail}`,
      );
    } finally {
      setSaving(false);
    }
  }

  const summaryText = t(
    "content.save_lesson.summary",
    "{exercises} exercises · {theory} theory steps · ~{minutes} min",
  )
    .replace("{exercises}", String(summary.exercises))
    .replace("{theory}", String(summary.theorySteps))
    .replace("{minutes}", String(summary.estimatedMinutes));

  return (
    <div className="modal-overlay" data-testid="save-offline-lesson-modal">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-lesson-title"
      >
        <h2 id="save-lesson-title" className="modal-title">
          {t("content.save_lesson.modal_title", "Save as offline lesson")}
        </h2>
        <label className="form-row">
          <span className="form-label">
            {t("content.save_lesson.title_label", "Lesson title")}
          </span>
          <input
            type="text"
            data-testid="save-lesson-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            autoFocus
          />
        </label>
        <p className="form-hint" data-testid="save-lesson-summary">
          {summaryText}
        </p>
        {summary.theoryOnly && (
          <p
            className="form-hint form-hint-warning"
            data-testid="save-lesson-theory-only"
          >
            {t(
              "content.save_lesson.theory_only",
              "Not enough vocabulary for exercises. Import a longer chat for more practice material.",
            )}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="save-lesson-cancel"
            onClick={onCancel}
            disabled={saving}
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="save-lesson-save"
            onClick={save}
            disabled={saving || title.trim().length === 0}
          >
            {saving
              ? t("common.loading", "Loading…")
              : t("content.save_lesson.save", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
