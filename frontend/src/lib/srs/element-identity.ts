/**
 * element-identity — the identity-preferring counterpart to
 * {@link elementKeysOf} (engine#91, element-level stable_id, one level below
 * exercise-identity.ts's exerciseIdentityOf).
 *
 * elementKeysOf() is NOT storage-only: for cloze and multiple_choice its
 * output is also written as the learner-facing ``correct_answer``
 * (element-attempt.ts), so it must keep returning real content text. This
 * module is a SEPARATE rule for the two places that need identity instead of
 * display - the SRS row's ``element_key`` and the #2128 update guard's
 * old-vs-new comparison (remap-plan.ts, update-impact.ts): prefer a
 * pair/blank/option's own ``stable_id``, fall back to the canonical text
 * elementKeysOf() already computes.
 *
 * Once an element has a minted stable_id, correcting its answer text no
 * longer moves this key at all - the update guard never even needs to
 * classify it as a correction, because nothing looks different at that
 * position. The one-time transition (old key = content text, new key =
 * fresh stable_id, same position, no collision) still classifies correctly
 * as a normal certain remap under the EXISTING remap-plan logic; no change
 * needed there.
 *
 * @example
 * ```ts
 * elementIdentityKeysOf({type: "matching", pairs: [{left: "merci", right: "danke", stable_id: "pair-x1"}]});
 * // -> ["pair-x1"]
 * ```
 */

import { elementKeysOf, type KeyBearingExercise } from "./element-keys";

/** Matching: one identity per pair, its own stable_id when minted. */
function matchingIdentityKeys(exercise: KeyBearingExercise, canonical: string[]): string[] {
  return (exercise.pairs ?? []).map((pair, i) => pair?.stable_id ?? canonical[i] ?? "");
}

/** Cloze type/select modes: one identity per blank, its own stable_id when
 *  minted. Multiselect is excluded by the caller - its single collapsed key
 *  is built from ``exercise.accept``, not from ``blanks[]`` at all, so a
 *  blank's stable_id has nothing to attach to there. */
function clozeIdentityKeys(exercise: KeyBearingExercise, canonical: string[]): string[] {
  return (exercise.blanks ?? []).map((blank, i) => blank?.stable_id ?? canonical[i] ?? "");
}

/** Multiple_choice: still ONE collapsed key (the SRS row model is
 *  unchanged), but built by substituting each correct option's own
 *  stable_id when minted, before the same sort+join as elementKeysOf. Partial
 *  minting still helps: an unminted option's text can still move the key,
 *  a minted one's cannot. */
function multipleChoiceIdentityKeys(exercise: KeyBearingExercise): string[] {
  return [
    (exercise.options ?? [])
      .filter((option) => option?.correct === true)
      .map((option) => option?.stable_id ?? option?.text ?? "")
      .sort()
      .join(", "),
  ];
}

/**
 * The identity keys ``exercise`` contributes for storage/comparison
 * purposes - prefer stable_id, fall back to {@link elementKeysOf}'s
 * canonical text. Same null/empty-array contract as elementKeysOf: ``null``
 * means the type is not known here, ``[]`` means the type is known and
 * contributes nothing.
 */
export function elementIdentityKeysOf(exercise: KeyBearingExercise): string[] | null {
  const canonical = elementKeysOf(exercise);
  if (canonical === null) return null;

  switch (exercise.type) {
    case "matching":
      return matchingIdentityKeys(exercise, canonical);
    case "cloze":
      if (exercise.cloze_mode === "multiselect") return canonical;
      return clozeIdentityKeys(exercise, canonical);
    case "multiple_choice":
      return multipleChoiceIdentityKeys(exercise);
    default:
      return canonical;
  }
}
