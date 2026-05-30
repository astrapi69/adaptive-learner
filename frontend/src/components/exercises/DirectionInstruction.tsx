/**
 * Per-direction instruction line (EXP-018 / Phase 62 / v1.46.0).
 *
 * A subtle one-line hint telling the learner what's expected:
 * recognise the meaning (receptive) vs produce the target
 * (productive). Cloze is in-context and renders nothing. Shared by
 * the FreeText / WordTiles / PictureChoice renderers; MatchingExercise
 * inlines its own (it already computes the direction to orient its
 * columns).
 */

import {Eye, Pencil} from "lucide-react";

import {useI18n} from "../../hooks/useI18n";
import {
  instructionKey,
  isProductive,
  resolveConcreteDirection,
} from "../../lib/exercises/direction";
import type {ContentLessonExercise} from "../../storage/types";

const FALLBACKS: Record<string, {receptive: string; productive: string}> = {
  free_text: {receptive: "What does this mean?", productive: "Translate:"},
  word_tiles: {
    receptive: "Build the translation",
    productive: "Build the sentence",
  },
  picture_choice: {
    receptive: "Pick the matching meaning",
    productive: "Pick the matching picture",
  },
};

export default function DirectionInstruction({
  exercise,
}: {
  exercise: ContentLessonExercise;
}) {
  const {t} = useI18n();
  // Cloze is inherently in-context; direction does not apply.
  if (exercise.type === "cloze") return null;
  const fallbacks = FALLBACKS[exercise.type];
  if (!fallbacks) return null;
  const direction = resolveConcreteDirection(exercise.direction, exercise.id);
  const fallback =
    direction === "source_to_target"
      ? fallbacks.productive
      : fallbacks.receptive;
  // Distinct ``direction-instruction-`` prefix (NOT
  // ``${type}-...``) so the testid never collides with an
  // exercise's own prefix selectors — e.g. the picture-choice
  // playthrough uses ``[data-testid^="picture-choice-"]`` to find
  // the choice tiles, which a ``picture-choice-...`` instruction id
  // would shadow. See lessons-learned "prefix testid overmatch".
  const testid = `direction-instruction-${exercise.type}`;
  const productive = isProductive(direction);
  // Subtle icon hint: eye = recognise (receptive), pencil = produce.
  const Icon = productive ? Pencil : Eye;
  const tooltip = productive
    ? t("lesson.exercise.direction.productive_hint", "Produce the answer")
    : t("lesson.exercise.direction.receptive_hint", "Recognise the meaning");
  return (
    <p
      className="exercise-direction-instruction"
      data-testid={testid}
      title={tooltip}
    >
      <Icon size={14} aria-hidden="true" />
      <span>{t(instructionKey(exercise.type, direction), fallback)}</span>
    </p>
  );
}
