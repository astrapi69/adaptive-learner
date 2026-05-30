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

import {useI18n} from "../../hooks/useI18n";
import {
  instructionKey,
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
  const testid = `${exercise.type.replace(/_/g, "-")}-direction-instruction`;
  return (
    <p className="exercise-direction-instruction" data-testid={testid}>
      {t(instructionKey(exercise.type, direction), fallback)}
    </p>
  );
}
