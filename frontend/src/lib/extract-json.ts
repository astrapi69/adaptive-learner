/**
 * Defensive JSON extraction (Phase 13 hotfix).
 *
 * The greedy ``\{[\s\S]*\}`` regex used by the early-Phase-12
 * analysis parser breaks on AI responses that contain ``{`` or
 * ``}`` characters in surrounding prose (e.g. claude-3-5-haiku
 * saying "the user struggled with {placeholder} concepts" before
 * the actual JSON). The greedy match grabs from the first ``{``
 * in the prose to the last ``}`` in the JSON, swallowing the
 * intervening text and crashing ``JSON.parse``.
 *
 * This helper replaces the regex with a stack-based balanced-
 * brace scan that is also string- and escape-aware. Algorithm:
 *
 *   1. Strip the input, drop any ```json``` / ``` ``` fences
 *      from anywhere in the string.
 *   2. Try ``JSON.parse`` on the whole thing (best case).
 *   3. If that fails, scan for every ``{`` and find its matching
 *      ``}`` with proper string-awareness (so braces inside a
 *      JSON string don't unbalance the scan).
 *   4. Try each candidate in decreasing-length order — the
 *      largest balanced object that parses is the answer (the
 *      actual analysis output is usually larger than any prose
 *      braces).
 *
 * Returns ``null`` on any structural failure. Caller decides
 * what to do with that (fallback, retry, etc.).
 */

const FENCE_PATTERN = /```(?:json|JSON)?\s*/g;
const PLAIN_FENCE = /```/g;

/**
 * Strip ``` fences anywhere in the string (not just at start /
 * end). Handles both ``` and ```json variants.
 */
export function stripFences(input: string): string {
    return input.replace(FENCE_PATTERN, "").replace(PLAIN_FENCE, "");
}

/**
 * Walk the input and emit every balanced ``{...}`` substring.
 * String literals and escape sequences are respected so that
 * a brace inside a quoted string doesn't unbalance the depth
 * counter.
 *
 * The result is sorted by length DESCENDING — the assumption
 * is that the largest balanced block is the actual JSON we
 * want, not a prose ``{like this}`` mention.
 */
export function findBalancedObjects(input: string): string[] {
    const results: string[] = [];
    for (let i = 0; i < input.length; i++) {
        if (input[i] !== "{") continue;
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let j = i; j < input.length; j++) {
            const ch = input[j];
            if (escape) {
                escape = false;
                continue;
            }
            if (ch === "\\") {
                escape = true;
                continue;
            }
            if (ch === '"') {
                inString = !inString;
                continue;
            }
            if (inString) continue;
            if (ch === "{") {
                depth++;
            } else if (ch === "}") {
                depth--;
                if (depth === 0) {
                    results.push(input.slice(i, j + 1));
                    break;
                }
            }
        }
    }
    results.sort((a, b) => b.length - a.length);
    return results;
}

/**
 * Try to extract one JSON object from a (possibly prose-wrapped)
 * AI response. Returns the parsed object or ``null`` on any
 * structural failure.
 *
 * Accepts:
 *   - Pure JSON                                                   ``{...}``
 *   - Fenced JSON                                                 ``\`\`\`json\n{...}\n\`\`\```
 *   - Prose-wrapped JSON                                          ``Here is the analysis: {...} Let me know!``
 *   - Prose containing other braces                               ``The user said {placeholder}. Result: {...}``
 *   - Multiple JSON objects                                       (picks the largest)
 */
export function extractJsonObject(
    raw: string,
): Record<string, unknown> | null {
    const stripped = stripFences(raw.trim());
    // Fast path: the whole stripped string is valid JSON.
    const direct = tryParse(stripped);
    if (direct !== null) return direct;
    // Slow path: find every balanced ``{...}`` candidate and try
    // each in decreasing-length order until one parses cleanly.
    const candidates = findBalancedObjects(stripped);
    for (const candidate of candidates) {
        const parsed = tryParse(candidate);
        if (parsed !== null) return parsed;
    }
    return null;
}

function tryParse(candidate: string): Record<string, unknown> | null {
    try {
        const data: unknown = JSON.parse(candidate);
        if (data && typeof data === "object" && !Array.isArray(data)) {
            return data as Record<string, unknown>;
        }
    } catch {
        /* fall through */
    }
    return null;
}
