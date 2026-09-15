/**
 * ``ext:al-parsons`` core (#3110) — a Parsons-problem exercise: arrange
 * shuffled code lines into the correct order AND at the correct
 * indentation depth. Mirrors the engine reference extension
 * ``ext:ref-parsons`` (engine#149), adopted here under the app's vendor
 * namespace, sibling of ``ext:al-hotspot`` (the pair share engine#149) and
 * ``ext:al-ordering`` (the simpler, non-indented sibling).
 *
 * Repeated code lines are allowed BY DESIGN — real programs repeat
 * statements (``pass``, ``return None``, a closing brace). Tiles are
 * therefore identified by POSITION (their index into ``lines``), never by
 * text, so ``orderingPayloadErrors``'s uniqueness rule does not apply here.
 *
 * This module is the ENGINE half (payload validation) plus pure helpers —
 * no React, no DnD, no code-highlighting import.
 */

import type {ContentLessonExercise} from "../../../storage/types";

/** The adopted extension type; declared as ``ext:al-parsons@<major>``. */
export const PARSONS_EXT_TYPE = "ext:al-parsons";

/** One code line in its correct position, at its correct indent depth
 *  (0-based block level — 0 = no indent, 1 = one nested block, …). */
export interface ParsonsLine {
    code: string;
    indent: number;
}

/** The ``ext_payload`` shape ``ext:al-parsons`` expects. */
export interface ParsonsPayload {
    /** The code lines in their correct order + indent (>= 2). */
    lines: ParsonsLine[];
    /** Optional language for syntax highlighting (e.g. "python"). */
    language?: string;
}

function isValidLine(value: unknown): value is ParsonsLine {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as {code?: unknown; indent?: unknown};
    return (
        typeof candidate.code === "string" &&
        typeof candidate.indent === "number" &&
        Number.isFinite(candidate.indent) &&
        candidate.indent >= 0
    );
}

/** Read the payload, or null when it is not shaped right (``lines`` an
 *  array of ``{code: string, indent: number >= 0}``, optional string
 *  ``language``). */
export function asParsonsPayload(
    exercise: ContentLessonExercise,
): ParsonsPayload | null {
    const payload = exercise.ext_payload;
    if (!payload) return null;
    if (!Array.isArray(payload.lines) || !payload.lines.every(isValidLine)) {
        return null;
    }
    if (payload.language !== undefined && typeof payload.language !== "string") {
        return null;
    }
    return {
        lines: payload.lines as ParsonsLine[],
        language: typeof payload.language === "string" ? payload.language : undefined,
    };
}

/** ENGINE half: validate one ``ext:al-parsons`` payload. Mirrors the
 *  engine reference rules (shape, line count, non-empty code). Returns
 *  human-readable messages; empty when valid. */
export function parsonsPayloadErrors(
    exercise: ContentLessonExercise,
): string[] {
    const payload = asParsonsPayload(exercise);
    if (!payload) {
        return [
            `'${exercise.id}' needs 'ext_payload' with lines ({code, indent}[]) and an optional language`,
        ];
    }
    const payloadErrors: string[] = [];
    if (payload.lines.length < 2) {
        payloadErrors.push(`'${exercise.id}' needs at least 2 lines`);
        return payloadErrors;
    }
    if (payload.lines.some((line) => line.code.trim() === "")) {
        payloadErrors.push(`'${exercise.id}' needs every line's code to be non-empty`);
    }
    return payloadErrors;
}

/** The canonical sequence (each line's code, joined by a newline) — the
 *  SRS element key. Empty string when the payload carries none. */
export function canonicalParsonsSequence(
    exercise: ContentLessonExercise,
): string {
    const payload = asParsonsPayload(exercise);
    return payload?.lines.map((line) => line.code).join("\n") ?? "";
}
