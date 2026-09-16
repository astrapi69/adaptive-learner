/**
 * ``ext:al-ordering`` core (#3110) — a sequence-ordering exercise: place a
 * set of steps into their correct order. Mirrors the engine's own first
 * reference extension ``ext:ref-ordering``, adopted here under the app's
 * vendor namespace (the same "adopt a `ref-*` extension as `al-*`" pattern
 * used for hotspot and parsons).
 *
 * Deliberately simpler than the sibling ``ext:al-parsons`` (no indentation,
 * no code): content that lists a procedure (an Ansible playbook's step
 * order, a hill start, right-of-way rules) had been expressing this with
 * ``word_tiles`` or ``multiple_choice`` workarounds; this extension names
 * the shape directly.
 *
 * ``items`` is the canonical ORDER (the array order IS the correct
 * sequence, no separate ``accept_orderings`` — unlike core ``word_tiles``
 * this type has no alternate-permutation authoring). The engine rejects a
 * duplicate item because a duplicate makes the correct order ambiguous
 * (which of the two identical entries goes where). This module is the
 * ENGINE half (payload validation) plus pure helpers — no React, no DnD.
 */

import type {ContentLessonExercise} from "../../../storage/types";

/** The adopted extension type; declared as ``ext:al-ordering@<major>``. */
export const ORDERING_EXT_TYPE = "ext:al-ordering";

/** The ``ext_payload`` shape ``ext:al-ordering`` expects. */
export interface OrderingPayload {
    /** The items in their correct order (>= 2, non-empty, unique). */
    items: string[];
}

/** Read the payload, or null when it is not shaped right (``items`` a
 *  string array). */
export function asOrderingPayload(
    exercise: ContentLessonExercise,
): OrderingPayload | null {
    const payload = exercise.ext_payload;
    if (!payload) return null;
    if (
        !Array.isArray(payload.items) ||
        !payload.items.every((entry) => typeof entry === "string")
    ) {
        return null;
    }
    return {items: payload.items as string[]};
}

/** ENGINE half: validate one ``ext:al-ordering`` payload. Mirrors the
 *  engine reference rules (shape, item count, non-empty items, uniqueness).
 *  Returns human-readable messages; empty when valid. */
export function orderingPayloadErrors(
    exercise: ContentLessonExercise,
): string[] {
    const payload = asOrderingPayload(exercise);
    if (!payload) {
        return [`'${exercise.id}' needs 'ext_payload' with items (string[])`];
    }
    const payloadErrors: string[] = [];
    if (payload.items.length < 2) {
        payloadErrors.push(`'${exercise.id}' needs at least 2 items`);
        return payloadErrors;
    }
    if (payload.items.some((item) => item.trim() === "")) {
        payloadErrors.push(`'${exercise.id}' needs every item to be non-empty`);
    }
    const seen = new Set<string>();
    const hasDuplicate = payload.items.some((item) => {
        if (seen.has(item)) return true;
        seen.add(item);
        return false;
    });
    if (hasDuplicate) {
        payloadErrors.push(
            `'${exercise.id}' needs every item to be unique — a duplicate makes the order ambiguous`,
        );
    }
    return payloadErrors;
}

/** The canonical sequence (``items`` joined by a space) — the SRS element
 *  key. Empty string when the payload carries none. */
export function canonicalOrderingSequence(
    exercise: ContentLessonExercise,
): string {
    const payload = asOrderingPayload(exercise);
    return payload?.items.join(" ") ?? "";
}
