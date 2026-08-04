/**
 * AIX-02 (EXP-036) — preview of AI-generated exercises.
 *
 * Rendered under the theory steps once the user generates exercises, so
 * they can see what will be appended to the lesson before saving. Pure +
 * presentational: it takes the mapped exercises and a ``t`` fn, renders a
 * compact, token-styled list (type chip + the prompt / sentence), and
 * owns no state.
 */

import { Sparkles } from "lucide-react";

import type { ContentLessonExercise } from "../../storage/types";

type Translate = (key: string, fallback?: string) => string;

interface GeneratedExercisesPreviewProps {
  exercises: ContentLessonExercise[];
  t: Translate;
}

/** English fallback labels for the generated text extension types (#2355),
 *  keyed by the ``ext:al-<name>`` type. */
const EXTENSION_FALLBACK: Record<string, string> = {
  "ext:al-reading-comprehension": "Reading comprehension",
  "ext:al-graded-quiz": "Graded quiz",
  "ext:al-categorization": "Categorization",
  "ext:al-error-correction": "Error correction",
};

/** Human label for an exercise type (localized, with English fallback). */
function typeLabel(type: ContentLessonExercise["type"], t: Translate): string {
  // #2355 — text extension types reuse the extension-wizard labels
  // (create_lesson.extensions.type.<name>), so no new i18n keys are needed.
  if (type.startsWith("ext:al-")) {
    const name = type.slice("ext:al-".length);
    return t(`create_lesson.extensions.type.${name}`, EXTENSION_FALLBACK[type] ?? type);
  }
  switch (type) {
    case "matching":
      return t("content.ai_exercises.type_matching", "Matching");
    case "cloze":
      return t("content.ai_exercises.type_cloze", "Cloze");
    case "free_text":
      return t("content.ai_exercises.type_free_text", "Free text");
    case "word_tiles":
      return t("content.ai_exercises.type_word_tiles", "Word tiles");
    case "picture_choice":
      return t("content.ai_exercises.type_picture_choice", "Picture choice");
    case "multiple_choice":
      return t("content.ai_exercises.type_multiple_choice", "Multiple choice");
    default:
      return type;
  }
}

/** The most descriptive single line for a preview row. */
function exerciseSummary(exercise: ContentLessonExercise): string {
  if (exercise.type === "cloze" && exercise.sentence) return exercise.sentence;
  return exercise.prompt;
}

/** Preview list of generated exercises shown before saving. */
export default function GeneratedExercisesPreview({
  exercises,
  t,
}: GeneratedExercisesPreviewProps) {
  if (exercises.length === 0) return null;
  return (
    <section
      className="mt-6 rounded-md border border-border bg-bg-surface p-4"
      data-testid="generated-exercises-preview"
    >
      <h2 className="m-0 mb-3 flex items-center gap-2 text-base font-semibold text-fg-primary">
        <Sparkles size={18} aria-hidden="true" />
        {t("content.ai_exercises.preview_title", "Generated exercises")}
        <span className="text-sm font-normal text-fg-muted">
          ({exercises.length})
        </span>
      </h2>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {exercises.map((exercise) => (
          <li
            key={exercise.id}
            className="flex flex-col gap-1 rounded-md bg-bg-elevated p-3 sm:flex-row sm:items-center sm:gap-3"
            data-testid="generated-exercise-row"
          >
            <span className="inline-flex w-fit shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
              {typeLabel(exercise.type, t)}
            </span>
            <span className="text-sm text-fg-primary">
              {exerciseSummary(exercise)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
