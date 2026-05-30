/**
 * Exercise drill-direction helpers (EXP-018 / Phase 62 / v1.46.0).
 *
 * Direction is the single most important EXP-018 concept: every
 * exercise is drilled either RECEPTIVELY (``target_to_source`` —
 * show the target language, recognise the source) or PRODUCTIVELY
 * (``source_to_target`` — show the source, produce the target).
 * Productive is inherently harder.
 *
 * This module centralises three pure operations so renderers and the
 * attempt-deriver stay consistent:
 *
 *   - ``resolveConcreteDirection`` collapses the authoring-level
 *     value (which may be ``"both"`` / ``"random"`` / absent) to ONE
 *     concrete direction an attempt can be recorded under.
 *   - ``resolveDirectionDisplay`` orients a (target, source) pair for
 *     display — the single source of truth for which side becomes the
 *     prompt and which the answer. (The codebase renders exercises
 *     from their authored fields, so this operates on the two strings
 *     rather than on a Card object — see EXP-018 62C decision.)
 *   - ``instructionKey`` maps (exercise type, direction) to the i18n
 *     key for the per-direction instruction line.
 */

export type ConcreteDirection = "source_to_target" | "target_to_source";

/**
 * Collapse an authoring-level direction to a concrete one. Concrete
 * values pass through; ``"both"`` / ``"random"`` resolve to a
 * deterministic pick derived from the exercise id (stable across
 * renders + tests, but varied across exercises); anything else
 * (including ``undefined``) defaults to receptive — the pre-62
 * implicit behaviour.
 */
export function resolveConcreteDirection(
  direction: string | null | undefined,
  exerciseId: string,
): ConcreteDirection {
  if (direction === "source_to_target") return "source_to_target";
  if (direction === "target_to_source") return "target_to_source";
  if (direction === "both" || direction === "random") {
    let hash = 0;
    for (let i = 0; i < exerciseId.length; i++) {
      hash = (hash * 31 + exerciseId.charCodeAt(i)) | 0;
    }
    return hash % 2 === 0 ? "target_to_source" : "source_to_target";
  }
  return "target_to_source";
}

export interface DirectionDisplay {
  /** The string shown to the learner. */
  prompt: string;
  /** The string the learner must recognise / produce. */
  answer: string;
  /** Which language the prompt is in. */
  promptLang: "target" | "source";
  /** Which language the answer is in. */
  answerLang: "target" | "source";
}

/**
 * Orient a (target-language, source-language) pair by direction.
 * Receptive: show the target, recognise the source. Productive: show
 * the source, produce the target.
 */
export function resolveDirectionDisplay(
  target: string,
  source: string,
  direction: ConcreteDirection,
): DirectionDisplay {
  if (direction === "source_to_target") {
    return {
      prompt: source,
      answer: target,
      promptLang: "source",
      answerLang: "target",
    };
  }
  return {
    prompt: target,
    answer: source,
    promptLang: "target",
    answerLang: "source",
  };
}

/** Is this a productive (harder) drill? */
export function isProductive(direction: ConcreteDirection): boolean {
  return direction === "source_to_target";
}

/**
 * i18n key for the per-direction instruction line of an exercise
 * type, e.g. ``lesson.exercise.instruction.matching.productive``.
 * Lives under the existing ``lesson.exercise.*`` catalog namespace.
 */
export function instructionKey(
  exerciseType: string,
  direction: ConcreteDirection,
): string {
  const mode = isProductive(direction) ? "productive" : "receptive";
  return `lesson.exercise.instruction.${exerciseType}.${mode}`;
}
