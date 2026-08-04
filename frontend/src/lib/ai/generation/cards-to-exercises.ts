/**
 * AIX-02 (EXP-036) — quality gate: AI cards -> renderable exercises.
 *
 * AIX-01's parser ({@link parseGeneratedExercises}) returns validated,
 * exercise-shaped ``cards[]``. This module maps each card onto a
 * schema-valid {@link ContentLessonExercise} the unmodified LessonViewer
 * can render, dropping anything that cannot become a *renderable*
 * exercise (the §4.4 quality gate):
 *
 *   - ``picture_choice`` is dropped: the AI supplies option labels but no
 *     image ``src``, and the picture-choice renderer needs images.
 *   - a ``cloze`` whose sentence does not have exactly one ``___`` marker
 *     is dropped: the schema requires ``blanks.length === marker count``
 *     and the parser only carries a single ``answer``.
 *   - ``word_tiles`` with fewer than two tokens is dropped.
 *
 * The surviving exercises are re-id'd sequentially with slug-safe ids so
 * they satisfy the lesson schema regardless of which cards contributed.
 *
 * Library-grade: pure mapping, no app-state / network imports. The cards
 * come from AIX-01; nothing here calls an AI provider.
 */

import type { ContentLessonExercise } from "../../../storage/types";
import type { GeneratedCard } from "./exercise-generation-parser";
import { isExtensionCard } from "./extension-cards";

/** Options for {@link cardsToExercises}. */
export interface CardsToExercisesOptions {
  /**
   * Generic instruction rendered above a cloze sentence (the blank lives
   * in the sentence itself, so the prompt is just the task description).
   * Defaults to an English fallback; the UI passes a localized string.
   */
  clozePrompt?: string;
}

/** Outcome of mapping AI cards to exercises. */
export interface CardsToExercisesResult {
  /** The schema-valid, re-id'd exercises. */
  exercises: ContentLessonExercise[];
  /** How many cards were dropped because they could not be rendered. */
  skipped: number;
}

const DEFAULT_CLOZE_PROMPT = "Fill in the missing word.";

/** Map one validated AI card to a renderable exercise, or ``null`` when
 *  it cannot become one. */
function mapCard(
  card: GeneratedCard,
  clozePrompt: string,
): Omit<ContentLessonExercise, "id"> | null {
  // #2355 — a text extension card carries its whole payload under
  // ``ext_payload``; the schema's ext exercise is just type + prompt + payload.
  if (isExtensionCard(card)) {
    return {
      type: card.type,
      prompt: card.question,
      card_ids: [],
      distractors: [],
      ext_payload: card.ext_payload,
    } as Omit<ContentLessonExercise, "id">;
  }
  switch (card.type) {
    case "matching":
      return {
        type: "matching",
        prompt: card.question,
        card_ids: [],
        pairs: card.pairs,
        distractors: [],
      };
    case "free_text":
      return {
        type: "free_text",
        prompt: card.question,
        card_ids: [],
        accept: card.accepts,
        distractors: card.distractors,
      };
    case "word_tiles": {
      const tiles = card.answer.split(/\s+/).filter(Boolean);
      if (tiles.length < 2) return null;
      return {
        type: "word_tiles",
        prompt: card.question,
        card_ids: [],
        tiles,
        distractors: [],
      };
    }
    case "cloze": {
      const markers = (card.question.match(/___/g) ?? []).length;
      // The schema requires one blank per marker; the parser only carries
      // a single answer, so anything other than exactly one blank is unsafe.
      if (markers !== 1) return null;
      const mode = card.distractors.length > 0 ? "select" : "type";
      return {
        type: "cloze",
        prompt: clozePrompt,
        card_ids: [],
        sentence: card.question,
        blanks: [{ accept: [card.answer] }],
        cloze_mode: mode,
        distractors: card.distractors,
      };
    }
    case "multiple_choice":
      // #2353 — MC is text-only (no assets), so it maps directly. The
      // model-facing ``is_correct`` becomes the schema's ``correct`` flag.
      return {
        type: "multiple_choice",
        prompt: card.question,
        card_ids: [],
        options: card.options.map((option) => ({
          text: option.text,
          correct: option.is_correct,
        })),
        multiple: card.multiple,
        distractors: [],
      };
    case "picture_choice":
      // The AI gives labels but no image sources; the renderer needs
      // images. Drop it rather than emit an unrenderable exercise.
      return null;
    default:
      return null;
  }
}

/**
 * Convert AIX-01 validated cards into renderable lesson exercises.
 *
 * @param cards - The validated cards from {@link parseGeneratedExercises}.
 * @param options - Localized prompt overrides.
 * @returns The exercises that survived the quality gate, plus a skip count.
 */
export function cardsToExercises(
  cards: GeneratedCard[],
  options: CardsToExercisesOptions = {},
): CardsToExercisesResult {
  const clozePrompt = options.clozePrompt?.trim() || DEFAULT_CLOZE_PROMPT;
  const mapped: Array<Omit<ContentLessonExercise, "id">> = [];
  let skipped = 0;
  for (const card of cards) {
    const exercise = mapCard(card, clozePrompt);
    if (exercise === null) {
      skipped++;
      continue;
    }
    mapped.push(exercise);
  }
  const exercises = mapped.map((exercise, index) => ({
    ...exercise,
    // Slug-safe id (lesson schema requires ``[a-z0-9-]``); any non-alphanumeric
    // run (``_`` in core types, ``:`` in ``ext:al-*`` types) becomes a hyphen,
    // and the ``ai-`` prefix keeps these distinct from the deterministic
    // generator's ``ex-`` ids.
    id: `ai-ex-${index + 1}-${exercise.type.replace(/[^a-z0-9]+/gi, "-")}`,
  }));
  return { exercises, skipped };
}
