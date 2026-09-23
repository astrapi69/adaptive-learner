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

/** Post-check verdict for one placed line. ``wrong_position`` wins over
 *  ``wrong_indent``: a line in the wrong slot is wrong whatever its depth. */
export type ParsonsLineStatus = "correct" | "wrong_position" | "wrong_indent";

/** One placed line as the learner left it, with its verdict. */
export interface ParsonsLineDiagnosis {
    code: string;
    /** The indent the learner chose for this slot. */
    indent: number;
    /** The canonical indent of the tile in this slot. */
    expectedIndent: number;
    status: ParsonsLineStatus;
}

/**
 * Explain a Parsons answer line by line (#3218), using exactly the rules of
 * {@link isParsonsCorrect}, so the per-line marks never disagree with the
 * overall verdict: a slot is ``wrong_position`` when the tile in it is not
 * the canonical tile for that slot, else ``wrong_indent`` when its chosen
 * depth differs from the tile's own canonical ``indent``.
 *
 * @param placed - Indices into ``lines`` in the learner's chosen order.
 * @param indents - The learner's chosen indent per SLOT.
 * @param lines - The payload's canonical ``{code, indent}`` lines.
 * @returns One entry per placed slot, in the learner's order.
 *
 * @example
 * diagnoseParsonsLines([0, 1], [0, 0], lines)
 * // -> [{..., status: "correct"}, {..., status: "wrong_indent"}]
 */
export function diagnoseParsonsLines(
    placed: readonly number[],
    indents: readonly number[],
    lines: readonly (IndentedLine & {code: string})[],
): ParsonsLineDiagnosis[] {
    return placed.map((tileIndex, slot) => {
        const line = lines[tileIndex];
        const indent = indents[slot] ?? 0;
        const expectedIndent = line?.indent ?? 0;
        let status: ParsonsLineStatus = "correct";
        if (tileIndex !== slot) status = "wrong_position";
        else if (indent !== expectedIndent) status = "wrong_indent";
        return {code: line?.code ?? "", indent, expectedIndent, status};
    });
}
