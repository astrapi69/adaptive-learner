/**
 * Grading for the native ``multiple_choice`` exercise type (schema v1.6,
 * engine 0.8.1, #1525).
 *
 * Contract (fixed in the engine schema, mirroring the cloze multiselect
 * grading): with ``multiple: false`` the single picked option must be the
 * one marked ``correct``; with ``multiple: true`` the learner must select
 * the EXACT set of correct options - no partial credit.
 *
 * Pure functions, individually testable; the renderer only wires them up.
 * Option texts are unique within an exercise (enforced by the schema
 * validator), so text identity is a safe selection key.
 */

/** The option shape the renderer works with (engine `MultipleChoiceOption`). */
export interface MultipleChoiceOptionLike {
    text: string;
    correct?: boolean;
}

/** Normalise an option text for set comparison (NFC + trim) - options are
 *  picked from a fixed list, but reviewed answers may round-trip through
 *  storage, so normalisation keeps the comparison robust. */
function _norm(value: string): string {
    return value.normalize("NFC").trim();
}

/** Texts of every option marked correct, in authored order. */
export function correctOptionTexts(
    options: readonly MultipleChoiceOptionLike[],
): string[] {
    return options
        .filter((option) => option.correct === true)
        .map((option) => option.text);
}

/** Exact-set verdict: the selected set equals the correct set. */
function _exactSetCorrect(
    selected: readonly string[],
    correct: readonly string[],
): boolean {
    const want = new Set(correct.map(_norm));
    const got = new Set(selected.map(_norm));
    if (want.size !== got.size) return false;
    for (const value of want) if (!got.has(value)) return false;
    return true;
}

/**
 * Grade a multiple_choice selection. Single mode requires exactly one
 * picked option and it must be the correct one; multi mode is an
 * exact-set match over the correct options (no partial credit).
 */
export function isMultipleChoiceCorrect(
    selected: readonly string[],
    options: readonly MultipleChoiceOptionLike[],
    multiple: boolean,
): boolean {
    const correct = correctOptionTexts(options);
    if (multiple) return _exactSetCorrect(selected, correct);
    return selected.length === 1 && _exactSetCorrect(selected, correct);
}
