/**
 * Resolve the source card the end-of-lesson correction round
 * ({@link CorrectionBlock}) feeds to the cloze generator for a given
 * ``ElementError`` (#1870).
 *
 * The card must be the one the learner actually missed so the generated
 * cloze blanks the right token. ``element_key`` is a CONTENT string (the
 * canonical answer/word — ``pair.left``, ``accept[0]``, the correction, …;
 * see ``lib/srs/element-attempt.ts``), never a card id, so the match anchors
 * on ``card.front`` (and ``token_roles``), consistent with the two other
 * cloze-from-error callers (``lib/review/review-lesson.ts`` +
 * ``lib/adaptive/exercise-pool.ts``).
 */

import type {
    ContentLesson,
    ContentLessonCard,
    ContentLessonExercise,
} from "../../../storage/types";

/**
 * Pick the card a correction-round cloze should be built from. Searches only
 * the cards the source exercise references, preferring an exact
 * ``front === element_key`` match, then a ``token_roles`` token match, and
 * finally the first referenced card (so the generator's literal-front path can
 * still fire). Returns ``null`` when the source exercise references no card.
 *
 * @example
 * ```ts
 * const card = resolveCorrectionSourceCard(lesson, sourceExercise, err.element_key);
 * const cloze = generateClozeFromError({error: err, sourceExercise, sourceCard: card});
 * ```
 */
export function resolveCorrectionSourceCard(
    lesson: ContentLesson,
    sourceExercise: ContentLessonExercise,
    elementKey: string,
): ContentLessonCard | null {
    const referenced = (card: ContentLessonCard): boolean =>
        sourceExercise.card_ids.includes(card.id);
    // 1. Exact front match — the canonical the generator targets.
    const byFront = lesson.cards.find(
        (c) => referenced(c) && c.front === elementKey,
    );
    if (byFront) return byFront;
    // 2. token_roles annotation whose token IS the missed element.
    const byRole = lesson.cards.find(
        (c) =>
            referenced(c) &&
            (c.token_roles ?? []).some((tr) => tr.token === elementKey),
    );
    if (byRole) return byRole;
    // 3. Fall back to the first referenced card so the generator's
    //    literal-front path can still fire.
    return lesson.cards.find(referenced) ?? null;
}
