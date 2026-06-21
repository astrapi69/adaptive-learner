/**
 * Cloze exercise generator from ElementError records
 * (Phase 52E / v1.35.0 / P-127, Q-111).
 *
 * Reads an SRS-recorded error + (optional) source card and emits a
 * synthesised Cloze exercise that targets the specific token the
 * user got wrong. Consumed by the correction-block (52F) at the end
 * of a lesson AND by the review-session synthesizer (52G) when the
 * source exercise type benefits from a shape change (free_text /
 * word_tiles per Decision 5 in the handover).
 *
 * Deterministic — same inputs produce identical output bytes. No
 * randomness, no AI, no async. The determinism property is pinned by
 * Q-111 tests so future refactors can't quietly break it (e.g.
 * accidental ``Math.random`` for distractor selection).
 *
 * Returns ``null`` when no cloze can be constructed from the input
 * — the caller falls back to replaying the original exercise. This
 * is the documented "graceful degradation" path: the user never
 * sees a broken correction round or a malformed review step.
 *
 * Algorithm (highest precedence first):
 *
 *   1. Card-based with token_roles match (Phase 52I / P-130):
 *      if ``sourceCard`` has a ``token_roles`` entry whose
 *      ``token === error.correct_answer``, blank that token in
 *      ``sourceCard.front``. This is the highest-fidelity path —
 *      the author explicitly annotated which token plays which
 *      grammatical role.
 *
 *   2. Card-based fallback: if ``sourceCard.front`` literally
 *      contains ``error.correct_answer`` exactly once, blank it.
 *      Catches the common case where the front is a phrase
 *      (``"yo soy"``) and the error is on one of its words
 *      (``"soy"``) without explicit token_roles.
 *
 *   3. free_text prompt fallback: if the source exercise's
 *      ``prompt`` contains ``error.correct_answer`` exactly once,
 *      blank it. Covers the case where the prompt is itself a
 *      sentence with the target word inline (``"Je vois ___ chat."``
 *      style prompts).
 *
 *   4. Otherwise: null (no cloze constructable — caller replays).
 *
 * Distractor pool (deterministic):
 *   - ``error.user_answer`` first (the specific mistake — guarantees
 *     the user's wrong choice appears in select-mode if the caller
 *     switches modes, AND surfaces it as a top-of-mind reminder)
 *   - Followed by ``sourceExercise.distractors`` entries that
 *     differ from the correct answer
 *   - De-duplicated; order preserved
 */

import type {
    ContentLessonCard,
    ContentLessonExercise,
    ElementError,
} from "../../storage/types";

export interface GenerateClozeArgs {
    error: ElementError;
    sourceExercise: ContentLessonExercise;
    sourceCard: ContentLessonCard | null;
}

/**
 * Synthesise a Cloze exercise that targets the specific token the user
 * got wrong, from an SRS error + (optional) source card. Deterministic
 * (no randomness / AI / async). Returns ``null`` when no cloze can be
 * constructed, so the caller falls back to replaying the original
 * exercise. See the module docstring for the full precedence algorithm
 * and distractor-pool contract.
 *
 * @returns The generated cloze exercise, or ``null`` (graceful fallback).
 */
export function generateClozeFromError({
    error,
    sourceExercise,
    sourceCard,
}: GenerateClozeArgs): ContentLessonExercise | null {
    const correct = error.correct_answer;
    if (!correct) return null;

    // Path 1: card-based with token_roles match.
    if (sourceCard) {
        const fromTokenRole = _tryCardTokenRoles(
            error,
            sourceExercise,
            sourceCard,
        );
        if (fromTokenRole) return fromTokenRole;

        // Path 2: card-based literal match in `front`.
        const fromCardFront = _tryCardFront(
            error,
            sourceExercise,
            sourceCard,
        );
        if (fromCardFront) return fromCardFront;
    }

    // Path 3: free_text prompt fallback.
    if (sourceExercise.type === "free_text") {
        const fromPrompt = _tryFreeTextPrompt(error, sourceExercise);
        if (fromPrompt) return fromPrompt;
    }

    return null;
}

function _tryCardTokenRoles(
    error: ElementError,
    sourceExercise: ContentLessonExercise,
    sourceCard: ContentLessonCard,
): ContentLessonExercise | null {
    const roles = sourceCard.token_roles ?? [];
    if (roles.length === 0) return null;
    const match = roles.find((tr) => tr.token === error.correct_answer);
    if (!match) return null;
    return _blankWithSingleMarker(
        error,
        sourceExercise,
        sourceCard,
        sourceCard.front,
        match.token,
    );
}

function _tryCardFront(
    error: ElementError,
    sourceExercise: ContentLessonExercise,
    sourceCard: ContentLessonCard,
): ContentLessonExercise | null {
    return _blankWithSingleMarker(
        error,
        sourceExercise,
        sourceCard,
        sourceCard.front,
        error.correct_answer,
    );
}

function _tryFreeTextPrompt(
    error: ElementError,
    sourceExercise: ContentLessonExercise,
): ContentLessonExercise | null {
    return _blankWithSingleMarker(
        error,
        sourceExercise,
        null,
        sourceExercise.prompt,
        error.correct_answer,
    );
}

/** Replace the first occurrence of ``target`` in ``haystack`` with
 *  ``___`` AND validate the result has exactly one marker. Rejects
 *  cases where ``target`` doesn't appear OR appears multiple times
 *  (the cloze schema requires ``blanks.length === sentence
 *  .count("___")``). */
function _blankWithSingleMarker(
    error: ElementError,
    sourceExercise: ContentLessonExercise,
    sourceCard: ContentLessonCard | null,
    haystack: string,
    target: string,
): ContentLessonExercise | null {
    if (!haystack || !target) return null;
    const firstIdx = haystack.indexOf(target);
    if (firstIdx === -1) return null;
    // Reject if the target also appears AFTER the first occurrence —
    // multi-instance haystacks confuse the i↔i blank mapping.
    if (haystack.indexOf(target, firstIdx + target.length) !== -1) {
        return null;
    }
    const sentence =
        haystack.slice(0, firstIdx) +
        "___" +
        haystack.slice(firstIdx + target.length);
    return _buildCloze(error, sourceExercise, sourceCard, sentence);
}

function _buildCloze(
    error: ElementError,
    sourceExercise: ContentLessonExercise,
    sourceCard: ContentLessonCard | null,
    sentence: string,
): ContentLessonExercise {
    const correct = error.correct_answer;
    const distractors = _buildDistractors(error, sourceExercise);
    return {
        id: `gen-cloze-${error.exercise_id}-${error.element_key}`,
        type: "cloze",
        prompt: sourceExercise.prompt,
        card_ids: sourceCard ? [sourceCard.id] : [],
        sentence,
        blanks: [
            {
                accept: [correct],
            },
        ],
        cloze_mode: "type",
        distractors,
    };
}

/** Deterministic distractor pool:
 *  - error.user_answer first (when different from the correct)
 *  - then sourceExercise.distractors entries (filtered to exclude
 *    the correct answer)
 *  - de-duplicated, order preserved. */
function _buildDistractors(
    error: ElementError,
    sourceExercise: ContentLessonExercise,
): string[] {
    const correct = error.correct_answer;
    const seen = new Set<string>();
    const out: string[] = [];
    if (error.user_answer && error.user_answer !== correct) {
        seen.add(error.user_answer);
        out.push(error.user_answer);
    }
    for (const distractor of sourceExercise.distractors ?? []) {
        if (distractor === correct) continue;
        if (seen.has(distractor)) continue;
        seen.add(distractor);
        out.push(distractor);
    }
    return out;
}
