/**
 * ordering-correctness — correctness check for the ``ext:al-ordering``
 * exercise (#3110).
 *
 * Unlike ``word_tiles`` (word-tiles-equivalence.ts) this type authors no
 * ``accept_orderings`` alternatives and grants no grammatical equivalence:
 * the payload's ``items`` array order IS the sole correct sequence, so
 * grading is a direct index-sequence comparison. Pure — no React, no
 * payload import (the caller already resolved ``itemCount``).
 */

/**
 * True iff ``placed`` (indices into the payload's ``items``, in the
 * learner's chosen order) is the canonical order ``[0, 1, …, itemCount-1]``.
 *
 * @param placed - Indices into ``items`` in the learner's chosen order.
 * @param itemCount - The payload's ``items.length``.
 */
export function isOrderingCorrect(
    placed: readonly number[],
    itemCount: number,
): boolean {
    if (placed.length !== itemCount) return false;
    return placed.every((tileIndex, slot) => tileIndex === slot);
}
