import { useState } from "react";

import { useI18n } from "../../hooks/useI18n";
import {
  cefrFromAnalysisLevel,
  detectTargetLanguage,
  generateLessonFromAnalysis,
  isShareableLesson,
  MIN_SHAREABLE_EXERCISES,
  slugify,
  summarizeGeneratedLesson,
  type AnalysisLessonLabels,
} from "../../lib/content/analysis-to-lesson";
import { getStorage } from "../../storage";
import type { ContentSetEntry } from "../../storage/types";
import type { ConversationAnalysisResult } from "../../types/domain";
import { notify } from "../../utils/notify";

/** Curated language options for the source/target pickers. Names are
 *  English; the BCP-47 code is what gets stored. */
const LANGUAGE_OPTIONS: ReadonlyArray<{code: string; name: string}> = [
  {code: "en", name: "English"},
  {code: "de", name: "German"},
  {code: "fr", name: "French"},
  {code: "es", name: "Spanish"},
  {code: "it", name: "Italian"},
  {code: "pt", name: "Portuguese"},
  {code: "el", name: "Greek"},
  {code: "tr", name: "Turkish"},
  {code: "ja", name: "Japanese"},
  {code: "zh", name: "Chinese"},
  {code: "ru", name: "Russian"},
  {code: "nl", name: "Dutch"},
  {code: "ar", name: "Arabic"},
];

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

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
  // EXP-018 follow-up bugfix: the saved set MUST carry a real
  // language PAIR (source != target), a CEFR level, and a
  // title_native — otherwise the sharing validator rejects it. The
  // learner SPEAKS the app language (source); the TARGET is guessed
  // from the topic and confirmed by the user.
  const appLang = (language || "en").split("-")[0];
  const detectedTarget = detectTargetLanguage(analysis.topic);
  const defaultTarget =
    detectedTarget && detectedTarget !== appLang
      ? detectedTarget
      : appLang === "en"
        ? "fr"
        : "en";
  const [sourceLang, setSourceLang] = useState(appLang);
  const [targetLang, setTargetLang] = useState(defaultTarget);
  const [level, setLevel] = useState<string>(
    cefrFromAnalysisLevel(analysis.user_level),
  );
  const [titleNative, setTitleNative] = useState(
    baseLesson.title || conversationTitle,
  );
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
        title_native: titleNative.trim() || finalTitle,
        language: targetLang,
        target_language: targetLang,
        source_language: sourceLang,
        level,
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
    .replace("{steps}", String(summary.theorySteps))
    .replace("{minutes}", String(summary.estimatedMinutes));

  // EXP-018 follow-up bugfix: the Save-as-Lesson flow must NEVER
  // produce an unshareable lesson — gate the Save button on the same
  // minimums the sharing validator enforces (>= 5 exercises across
  // >= 2 types). A same-language pair is NOT a hard block: a grammar
  // or native-language study lesson (German grammar for German
  // speakers) is a legitimate offline lesson. It only affects the
  // language-pair tree placement when shared, so we surface it as an
  // informational hint, not a gate.
  const shareable = isShareableLesson(summary);
  const sameLanguage = sourceLang === targetLang;
  const canSave = shareable && title.trim().length > 0;

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
        <label className="form-row">
          <span className="form-label">
            {t("content.save_lesson.title_native_label", "Title in target language")}
          </span>
          <input
            type="text"
            data-testid="save-lesson-title-native-input"
            value={titleNative}
            onChange={(e) => setTitleNative(e.target.value)}
            disabled={saving}
          />
        </label>
        <div className="form-row form-row-inline">
          <label className="form-field">
            <span className="form-label">
              {t("content.save_lesson.target_lang_label", "Language learned")}
            </span>
            <select
              data-testid="save-lesson-target-lang"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              disabled={saving}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">
              {t("content.save_lesson.source_lang_label", "Your language")}
            </span>
            <select
              data-testid="save-lesson-source-lang"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              disabled={saving}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">
              {t("content.save_lesson.level_label", "Level")}
            </span>
            <select
              data-testid="save-lesson-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              disabled={saving}
            >
              {CEFR_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="form-hint" data-testid="save-lesson-summary">
          {summaryText}
        </p>
        {!shareable && (
          <p
            className="form-hint form-hint-warning"
            data-testid="save-lesson-not-enough-data"
          >
            {t(
              "content.save_lesson.not_enough_data",
              "Not enough vocabulary for a full lesson (need at least {min} exercises). Import a longer chat for more practice material.",
            ).replace("{min}", String(MIN_SHAREABLE_EXERCISES))}
          </p>
        )}
        {sameLanguage && (
          <p
            className="form-hint"
            data-testid="save-lesson-same-language"
          >
            {t(
              "content.save_lesson.same_language_hint",
              "Learned and your language are the same — fine for a grammar or native-language lesson. When shared, it lands in the same-language branch of the content tree.",
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
            disabled={saving || !canSave}
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
