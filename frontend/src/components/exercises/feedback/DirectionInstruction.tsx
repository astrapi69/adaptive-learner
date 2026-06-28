/**
 * Per-direction instruction line (EXP-018 / Phase 62 / v1.46.0).
 *
 * A subtle one-line hint telling the learner what's expected:
 * recognise the meaning (receptive) vs produce the target
 * (productive). Cloze is in-context and renders nothing. Shared by
 * the FreeText / WordTiles / PictureChoice renderers; MatchingExercise
 * inlines its own (it already computes the direction to orient its
 * columns).
 *
 * #1226 (EXP-041): the instruction is also domain-aware. For a knowledge
 * lesson (non-language domain, or source==target) there is nothing to
 * translate, so a type with a ``KNOWLEDGE_FALLBACKS`` entry uses a
 * knowledge instruction instead of the translation-framed wording —
 * mirroring the MatchingExercise #149 rule via the shared
 * ``isKnowledgeDomain`` decision.
 */

import {Eye, Pencil} from "lucide-react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {
  instructionKey,
  isProductive,
  resolveConcreteDirection,
} from "../../../lib/exercises/direction";
import {isKnowledgeDomain} from "../../../lib/exercises/knowledge-domain";
import type {ContentLessonExercise} from "../../../storage/types";

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

/** Knowledge (non-language) instruction per type: no translation framing.
 *  Only types listed here switch to knowledge wording; others keep the
 *  direction-based instruction. #1226 ships word_tiles; the map is the
 *  extension point for free_text / picture_choice if they need it later. */
const KNOWLEDGE_FALLBACKS: Record<string, string> = {
  word_tiles: "Build the sentence",
};

export default function DirectionInstruction({
  exercise,
  domain = null,
  sourceLanguage = null,
  targetLanguage = null,
}: {
  exercise: ContentLessonExercise;
  /** #1226 — lesson domain ("language" | "programming" | …). */
  domain?: string | null;
  /** #1226 — BCP-47 source language (what the learner speaks). */
  sourceLanguage?: string | null;
  /** #1226 — BCP-47 target language (what the learner learns). */
  targetLanguage?: string | null;
}) {
  const {t} = useI18n();
  // Cloze is inherently in-context; direction does not apply.
  if (exercise.type === "cloze") return null;
  const fallbacks = FALLBACKS[exercise.type];
  if (!fallbacks) return null;
  const direction = resolveConcreteDirection(exercise.direction, exercise.id);

  // #1226 / EXP-041 — a knowledge lesson has nothing to translate. When
  // this type defines a knowledge instruction, use it (regardless of
  // direction) so word_tiles for de->de content reads "Build the
  // sentence", not "Build the translation".
  const knowledgeFallback = KNOWLEDGE_FALLBACKS[exercise.type];
  const useKnowledge =
    !!knowledgeFallback &&
    isKnowledgeDomain(domain, sourceLanguage, targetLanguage);
  if (useKnowledge) {
    return (
      <p
        className="exercise-direction-instruction"
        data-testid={`direction-instruction-${exercise.type}`}
        title={t("lesson.exercise.direction.productive_hint", "Produce the answer")}
      >
        <Pencil size={14} aria-hidden="true" />
        <span>
          {t(
            `lesson.exercise.instruction.${exercise.type}.knowledge`,
            knowledgeFallback,
          )}
        </span>
      </p>
    );
  }

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
