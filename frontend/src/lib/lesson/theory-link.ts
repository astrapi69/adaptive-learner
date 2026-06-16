/**
 * Theory back-link resolution (#140, #634).
 *
 * Pure, runtime-only mapping from an exercise step to the theory step it
 * practices. No schema field — the lesson's existing step order, step
 * ``type``/``title``/``body``, and the cards an exercise references are
 * the only inputs, so any lesson supports it without content changes.
 *
 * #634: the original "nearest preceding theory" rule lands on the wrong
 * block when an unrelated theory sits between the matching theory and
 * the exercise (e.g. a Bandura block between the Pawlow theory and the
 * "Pawlows Begriffe zuordnen" exercise). ``findRelatedTheoryIndex``
 * instead picks the preceding theory whose text best overlaps the
 * exercise's own terms, falling back to the nearest one when there is no
 * textual signal.
 */

import type {
    ContentLessonCard,
    ContentLessonStep,
} from "../../storage/types";

/**
 * Find the index of the nearest theory step that appears before
 * ``currentIndex``.
 *
 * Returns ``null`` when the current step is itself a theory step,
 * when ``currentIndex`` is out of range, or when no theory step
 * precedes it (so the UI offers no link rather than a dead one).
 */
export function findPrecedingTheoryIndex(
    steps: ContentLessonStep[],
    currentIndex: number,
): number | null {
    const current = steps[currentIndex];
    if (!current || current.type === "theory") return null;
    for (let i = currentIndex - 1; i >= 0; i--) {
        if (steps[i].type === "theory") return i;
    }
    return null;
}

/** German + English stopwords + generic exercise verbs that carry no
 *  topical signal, so they never drive a match. Lowercased. */
const STOPWORDS = new Set<string>([
    "und",
    "oder",
    "der",
    "die",
    "das",
    "den",
    "dem",
    "des",
    "ein",
    "eine",
    "einen",
    "einem",
    "mit",
    "für",
    "von",
    "zum",
    "zur",
    "the",
    "and",
    "for",
    "with",
    "from",
    // Generic exercise instruction verbs/nouns.
    "zuordnen",
    "ordne",
    "ordnen",
    "begriffe",
    "begriff",
    "aufgabe",
    "übung",
    "match",
    "matching",
    "fill",
    "blank",
    "choose",
    "select",
]);

/** Lowercase significant tokens (letters/digits, length >= 4, not a
 *  stopword) of a free-text blob. Diacritics are kept so German terms
 *  stay distinct ("reiz" etc). */
function significantTokens(text: string | null | undefined): string[] {
    if (!text) return [];
    return text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((tok) => tok.length >= 4 && !STOPWORDS.has(tok));
}

/** Collect the topical terms an exercise step contributes: its prompt
 *  plus the front/back/tags of the cards it references. */
function exerciseTerms(
    step: ContentLessonStep,
    cards: ContentLessonCard[],
): Set<string> {
    const terms = new Set<string>();
    const ex = step.exercise;
    if (!ex) return terms;
    for (const tok of significantTokens(ex.prompt)) terms.add(tok);
    const byId = new Map(cards.map((c) => [c.id, c]));
    for (const cardId of ex.card_ids ?? []) {
        const c = byId.get(cardId);
        if (!c) continue;
        for (const tok of significantTokens(c.front)) terms.add(tok);
        for (const tok of significantTokens(c.back)) terms.add(tok);
        for (const tag of c.tags ?? []) {
            for (const tok of significantTokens(tag)) terms.add(tok);
        }
    }
    return terms;
}

/** How many of the exercise's distinct terms appear in a theory step's
 *  title + body (substring match, so "reiz" hits "reizgeneralisierung"). */
function theoryOverlap(
    theoryStep: ContentLessonStep,
    terms: Set<string>,
): number {
    if (terms.size === 0) return 0;
    const haystack = `${theoryStep.title ?? ""} ${
        theoryStep.body ?? ""
    }`.toLowerCase();
    if (haystack.trim() === "") return 0;
    let score = 0;
    for (const term of terms) {
        if (haystack.includes(term)) score += 1;
    }
    return score;
}

/**
 * Find the theory step an exercise practices: the preceding theory step
 * whose text best overlaps the exercise's own terms (prompt + referenced
 * cards). Ties are broken toward the NEAREST matching theory. When no
 * preceding theory shares any term (no topical signal), this falls back
 * to {@link findPrecedingTheoryIndex} so lessons with generic theory
 * keep the original nearest-preceding behaviour.
 *
 * Returns ``null`` under the same conditions as
 * {@link findPrecedingTheoryIndex} (current step is theory, out of
 * range, or no preceding theory exists).
 */
export function findRelatedTheoryIndex(
    steps: ContentLessonStep[],
    cards: ContentLessonCard[],
    currentIndex: number,
): number | null {
    const nearest = findPrecedingTheoryIndex(steps, currentIndex);
    if (nearest === null) return nearest;

    const terms = exerciseTerms(steps[currentIndex], cards);
    let bestIndex = -1;
    let bestScore = 0;
    // Walk preceding theory steps nearest-first so the first index that
    // reaches ``bestScore`` wins ties (the nearest matching theory).
    for (let i = currentIndex - 1; i >= 0; i--) {
        if (steps[i].type !== "theory") continue;
        const score = theoryOverlap(steps[i], terms);
        if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }
    return bestScore > 0 ? bestIndex : nearest;
}
