/**
 * Free-text answer grading (#1877) — the tolerant matcher shared by every
 * exercise type that accepts a typed answer.
 *
 * Extracted verbatim from ``FreeTextExercise.tsx`` (the renderer it grew up
 * in) into ``lib/exercises/grading/`` so grading logic lives in the grading
 * layer, not inside a renderer — consistent with the #1862/#1867
 * grading/payload consolidation, and so a new consumer (e.g. the planned
 * ``ext:al-dictation`` renderer) imports the grader from here instead of
 * reaching across into another renderer. Pure + framework-free (no React,
 * no DOM); behaviour is byte-identical to the pre-extraction functions.
 *
 * {@link isFreeTextCorrect} decides acceptance (NFC/locale-normalized exact
 * match first, then a Levenshtein fallback within {@link _editTolerance});
 * {@link isFreeTextNearMiss} drives the encouraging "Almost!" feedback (#627).
 * ``codeMode`` (schema v1.3) switches to the case-preserving,
 * whitespace-stripping, quote-unifying normalizer for code answers.
 *
 * @example
 * ```ts
 * isFreeTextCorrect("Mercii", ["Merci"]);        // true  (1 edit)
 * isFreeTextCorrect("Marcy", ["Merci"]);         // false (2 edits)
 * isFreeTextNearMiss("Marcy", ["Merci"]);        // true  (within tolerance+1)
 * ```
 */

/** Levenshtein edit distance between ``a`` and ``b``.
 *  Two-row DP variant: O(m*n) time, O(n) space. The free-
 *  text exercise compares short authored answers (typically
 *  under 30 chars), so the matrix stays small. */
function _levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    let prev = new Array<number>(b.length + 1);
    let curr = new Array<number>(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost,
            );
        }
        [prev, curr] = [curr, prev];
    }
    return prev[b.length];
}

/** Plain-text grading normalization (#1580). NFC + locale-aware lowercase
 *  as before, plus the surface variants a mobile keyboard produces and a
 *  sentence answer should never fail on: the curly-apostrophe/quote family
 *  is unified to ASCII, inner whitespace collapses to single spaces, and
 *  terminal sentence punctuation (``.!?…``) is stripped on both sides
 *  of the comparison. Inner punctuation stays significant. */
function _normalize(s: string): string {
    return s
        .normalize("NFC")
        .replace(/[‘’‚ʼ´`]/g, "'")
        .replace(/[“”„«»]/g, '"')
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[.!?…]+$/, "")
        .trim()
        .toLocaleLowerCase();
}

/** Edit budget for the fuzzy fallback (#1580). Short answers keep the
 *  strict single-edit rule (D1: "Mercii" passes, "Marci" stays wrong);
 *  sentence-length answers (>= 16 normalized chars) earn a second edit so
 *  one real typo plus one small slip does not fail a correct sentence.
 *  Measured against the AUTHORED candidate, so the learner cannot widen
 *  the budget by padding the input. */
function _editTolerance(normalizedCandidate: string): number {
    return normalizedCandidate.length >= 16 ? 2 : 1;
}

/** Code-answer normalization (schema v1.3). Code is CASE-sensitive,
 *  so we keep case — but we drop ALL whitespace (so "print( 'x' )" ==
 *  "print('x')") and unify quote styles (', ", ` -> "), the two
 *  variations a learner shouldn't be marked wrong for. Authors can
 *  still add explicit ``accept`` entries for cases where spacing is
 *  semantically meaningful. */
function _normalizeCode(s: string): string {
    return s.replace(/\s+/g, "").replace(/['"`]/g, '"');
}

/** True iff ``input`` matches any entry of ``accept``: normalized exact
 *  match first, Levenshtein fallback within ``_editTolerance`` (1 for short
 *  answers, 2 for sentence-length ones, #1580). Empty input never matches.
 *  In ``codeMode`` the normalizer is whitespace-stripping + quote-unifying +
 *  case-preserving, and the budget stays 1 regardless of length (code must
 *  not absorb two edits: println != print). */
export function isFreeTextCorrect(
    input: string,
    accept: readonly string[],
    codeMode = false,
): boolean {
    const norm = codeMode ? _normalizeCode : _normalize;
    const normInput = norm(input);
    if (normInput === "") return false;
    const normCandidates = accept.map(norm);
    if (normCandidates.includes(normInput)) return true;
    for (const cand of normCandidates) {
        const tolerance = codeMode ? 1 : _editTolerance(cand);
        if (_levenshtein(normInput, cand) <= tolerance) return true;
    }
    return false;
}

/** True iff a WRONG answer is a *near miss* — a small typo within 2 edits
 *  of the closest accepted answer (but not already accepted, which the ≤1
 *  matcher handles). Drives the encouraging "Almost! Watch out for:"
 *  feedback instead of a flat "Not quite." (#627). Empty input is never a
 *  near miss. */
export function isFreeTextNearMiss(
    input: string,
    accept: readonly string[],
    codeMode = false,
): boolean {
    if (isFreeTextCorrect(input, accept, codeMode)) return false;
    const norm = codeMode ? _normalizeCode : _normalize;
    const normInput = norm(input);
    if (normInput === "") return false;
    return accept.some((cand) => {
        const normCandidate = norm(cand);
        const tolerance = codeMode ? 1 : _editTolerance(normCandidate);
        const distance = _levenshtein(normInput, normCandidate);
        return distance > 0 && distance <= tolerance + 1;
    });
}
