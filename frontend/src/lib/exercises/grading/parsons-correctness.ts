/**
 * parsons-correctness — correctness check for the ``ext:al-parsons``
 * exercise (#3110).
 *
 * Grades on ORDER and INDENTATION together: a right sequence at the wrong
 * depth is wrong (per the issue's contract). The payload's ``lines`` array
 * order is the sole correct sequence (mirrors ``isOrderingCorrect`` — no
 * authored alternatives); each placed tile's indentation is checked
 * against its OWN canonical ``indent`` (``lines[tileIndex].indent``), so a
 * per-position indent choice is graded against the tile that actually sits
 * there. Pure — no React, no payload import.
 */

/** The shape ``isParsonsCorrect`` needs from a line — only ``indent``. */
interface IndentedLine {
    indent: number;
}

/**
 * True iff ``placed`` (indices into the payload's ``lines``, in the
 * learner's chosen order) is the canonical order ``[0, 1, …, n-1]`` AND
 * every placed tile's chosen indent (``indents[slot]``) matches its own
 * canonical ``lines[placed[slot]].indent``.
 *
 * @param placed - Indices into ``lines`` in the learner's chosen order.
 * @param indents - The learner's chosen indent per SLOT (same length as
 *   ``placed``).
 * @param lines - The payload's canonical ``{code, indent}`` lines.
 */
export function isParsonsCorrect(
    placed: readonly number[],
    indents: readonly number[],
    lines: readonly IndentedLine[],
): boolean {
    if (placed.length !== lines.length || indents.length !== lines.length) {
        return false;
    }
    return placed.every((tileIndex, slot) => {
        if (tileIndex !== slot) return false;
        return indents[slot] === lines[tileIndex]?.indent;
    });
}
