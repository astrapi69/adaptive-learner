/**
 * Cloze select-mode grading (#3167).
 *
 * A ``cloze`` in ``select`` (or ``multiselect``) mode offers the learner a
 * fixed option list: the canonical ``accept`` plus the authored
 * ``distractors``. The picked string is byte-identical to one of those
 * entries, so there is no typo to forgive. Grading a pick with the typed
 * answer matcher ({@link isFreeTextCorrect}: lowercase + Levenshtein
 * budget) let every distractor within that budget pass as correct, which
 * is exactly where distractors live when they are code variants of the
 * answer (``{name}`` vs ``$name``). Select mode therefore grades by exact
 * membership after the same NFC + trim normalisation ``ClozeMultiSelect``
 * always used for its set comparison; the type mode keeps the tolerant
 * matcher. Pure + framework-free (no React, no DOM).
 *
 * @example
 * ```ts
 * isClozeSelectCorrect("<p>Hallo {name}</p>", ["<p>Hallo {name}</p>"]); // true
 * isClozeSelectCorrect("<p>Hallo $name</p>", ["<p>Hallo {name}</p>"]);  // false
 * isClozeSelectCorrect("usestate", ["useState"]);                       // false
 * ```
 */

/** Normalise an authored option or a pick for comparison: NFC + trim,
 *  nothing else. Case, inner whitespace and punctuation stay significant
 *  because the learner chose the string, they did not type it. */
export function normalizeClozeChoice(value: string): string {
    return value.normalize("NFC").trim();
}

/** True iff the picked ``choice`` is one of the ``accept`` entries after
 *  {@link normalizeClozeChoice}. An empty pick never matches, even against
 *  a blank accept entry. */
export function isClozeSelectCorrect(
    choice: string,
    accept: readonly string[],
): boolean {
    const picked = normalizeClozeChoice(choice);
    if (picked === "") return false;
    return accept.some((entry) => normalizeClozeChoice(entry) === picked);
}
