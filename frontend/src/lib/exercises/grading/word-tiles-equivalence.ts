/**
 * word-tiles-equivalence — correctness check for the Word-Tiles
 * ("Setze den Kernsatz zusammen") exercise.
 *
 * The learner places tiles into an order; we score that order against the
 * canonical solution. Scoring compares the composed TOKEN SEQUENCE, not the
 * physical tile indices: duplicate tiles (two identical "die") are
 * interchangeable, so string-identical answers always grade the same no
 * matter which duplicate the learner tapped (#1544). There are THREE
 * acceptance layers, in priority order:
 *
 *   1. **Exact canonical** — the placed order equals ``tiles`` order
 *      (indices ``[0, 1, …, n-1]``). Always accepted.
 *   2. **Explicit alternatives (Mechanism A)** — the placed order exactly
 *      equals one of the authored ``accept_orderings`` permutations. This is
 *      the safe, content-driven core: an author lists every additional valid
 *      ordering. Absent → only the canonical order is exact-accepted.
 *   3. **Automatic equivalence (Mechanism B)** — a CONSERVATIVE fallback for
 *      content that did not author alternatives. It accepts ONLY a narrow,
 *      grammatically-licensed reordering: a single German mid-field
 *      adversative connector ("aber", "jedoch", …) moved to the other side of
 *      an adjacent finite-verb cluster, with the rest of the sentence
 *      unchanged. See {@link equivalentByConnectorMove} for the exact guard.
 *
 * Why Mechanism B is deliberately narrow (the central design constraint):
 * loosening order-matching must NEVER turn "any permutation is fine" on — that
 * would destroy the exercise. A false "rot" on a valid alternative is a minor
 * annoyance; a false "grün" on a wrong order destroys the learning signal. So
 * B errs on the side of rejecting: when in doubt, NOT equivalent.
 *
 * Covered by Mechanism B:
 *   - Connector mobility: "…, aber erinnert sich an …" ⇄
 *     "…, erinnert sich aber an …" (the documented #-case). The connector
 *     "aber" swaps across the finite-verb(+reflexive) cluster; everything
 *     else keeps its relative order.
 *
 * Deliberately NOT covered by Mechanism B (use ``accept_orderings`` instead):
 *   - Free reflexive-pronoun repositioning that is not driven by a connector
 *     move (e.g. "sich" jumping on its own) — its licensed positions need real
 *     grammar analysis to tell apart from ungrammatical placements.
 *   - Modal particles (auch / nur / schon / …) whose movement often shifts
 *     scope or meaning.
 *   - Any reordering that moves more than one token, reorders content words
 *     (nouns), or changes meaning.
 */

/**
 * German mid-field adversative connectors whose position relative to an
 * adjacent finite-verb cluster is grammatically flexible ("…, aber V …" vs
 * "…, V … aber"). Conservative, closed allowlist — only a tile whose
 * normalized text is in this set may relocate under Mechanism B.
 */
export const MOVABLE_CONNECTORS: ReadonlySet<string> = new Set([
    "aber",
    "jedoch",
    "allerdings",
    "dennoch",
    "doch",
]);

/**
 * Personal + reflexive pronouns that legitimately sit inside the German
 * Mittelfeld verb cluster. Their presence in the span a connector jumps is a
 * strong signal that the span is a verb cluster (not a noun phrase), which is
 * exactly the context that licenses the connector move.
 */
const MITTELFELD_PRONOUNS: ReadonlySet<string> = new Set([
    "er",
    "sie",
    "es",
    "ich",
    "du",
    "wir",
    "ihr",
    "man",
    "sich",
    "mich",
    "dich",
    "uns",
    "euch",
    "mir",
    "dir",
]);

/** Common finite verbs that do NOT match the morphological suffix heuristic
 *  below but must still count as verb-like (irregular present forms). */
const IRREGULAR_FINITE_VERBS: ReadonlySet<string> = new Set([
    "ist",
    "war",
    "wird",
    "sind",
    "hat",
    "kann",
    "muss",
    "will",
    "soll",
    "mag",
    "darf",
    "weiss",
    "weiß",
]);

/** Lowercase a tile and strip trailing sentence punctuation, so "Quelle,"
 *  and "quelle" compare by their word core. Leading/inner characters are
 *  kept (German nouns stay capitalized BEFORE this — capitalization is read
 *  via {@link startsCapitalized} on the raw tile, not here). */
function normToken(raw: string): string {
    return raw.trim().toLowerCase().replace(/[.,;:!?»«"'）)]+$/u, "");
}

/** True when the raw tile begins with an uppercase letter — in German, the
 *  hallmark of a noun. A connector jumping a noun is NOT licensed, so the
 *  guard forbids capitalized tiles in the jumped span. */
function startsCapitalized(raw: string): boolean {
    const ch = raw.trim().charAt(0);
    return ch !== "" && ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

/** Heuristic "looks like a finite verb": a lowercase token ending in a common
 *  German finite-verb suffix, or a known irregular present form. Used ONLY to
 *  confirm that the span a connector jumped is a verb cluster. */
function isVerbLike(token: string): boolean {
    if (IRREGULAR_FINITE_VERBS.has(token)) return true;
    return /(?:est|et|st|en|te|ten|t|e)$/.test(token);
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Remap the learner's physical tile indices onto ``target``'s tile indices
 * by token text: the k-th occurrence of a token text in ``placed`` is
 * assigned the tile index of the k-th occurrence of that text in
 * ``target``. Duplicate tiles thus become interchangeable - the grade
 * depends on the composed token sequence, never on WHICH of two identical
 * tiles the learner tapped (#1544). For duplicate-free tile sets this is
 * the identity mapping, so grading of existing content is unchanged. A
 * placed tile whose text has no unmatched occurrence left keeps its
 * physical index, which guarantees a mismatch downstream instead of a
 * crash on malformed input.
 */
function remapPlacedByTokenText(
    placed: readonly number[],
    target: readonly number[],
    tiles: readonly string[],
): number[] {
    const unmatchedTargetIndices = new Map<string, number[]>();
    for (const targetTileIndex of target) {
        const tokenText = tiles[targetTileIndex] ?? "";
        const occurrenceQueue = unmatchedTargetIndices.get(tokenText);
        if (occurrenceQueue) {
            occurrenceQueue.push(targetTileIndex);
        } else {
            unmatchedTargetIndices.set(tokenText, [targetTileIndex]);
        }
    }
    return placed.map((placedTileIndex) => {
        const tokenText = tiles[placedTileIndex] ?? "";
        const occurrenceQueue = unmatchedTargetIndices.get(tokenText);
        return occurrenceQueue?.shift() ?? placedTileIndex;
    });
}

/**
 * Mechanism B core: is ``placed`` a grammatically-licensed connector-move
 * variant of ``target``? Both are index sequences into ``tiles`` and the same
 * length. Returns true ONLY when ALL of the following hold:
 *
 *   1. Exactly ONE tile differs in position, and that tile's normalized text
 *      is a {@link MOVABLE_CONNECTORS} member. Concretely: removing that one
 *      tile from both ``placed`` and ``target`` yields identical sequences —
 *      i.e. nothing else moved, every other token keeps its relative order.
 *   2. The connector moved by 1 or 2 positions (a finite verb, optionally plus
 *      a reflexive/pronoun — never a long-range jump).
 *   3. The span it jumped contains NO capitalized tile (no noun) and is
 *      "verb-cluster-like": it holds at least one Mittelfeld pronoun or one
 *      verb-like token. This is what rules out "der **aber** Hund" and
 *      "sehr **aber** schnell".
 *
 * Anything else → false (NOT equivalent). This never accepts a free
 * permutation: condition 1 alone already pins every non-connector token.
 */
export function equivalentByConnectorMove(
    placed: readonly number[],
    target: readonly number[],
    tiles: readonly string[],
): boolean {
    if (placed.length !== target.length) return false;
    if (arraysEqual(placed, target)) return false; // handled as an exact match

    for (const connectorTile of placed) {
        const label = normToken(tiles[connectorTile] ?? "");
        if (!MOVABLE_CONNECTORS.has(label)) continue;

        const placedWithout = placed.filter((i) => i !== connectorTile);
        const targetWithout = target.filter((i) => i !== connectorTile);
        // Condition 1: the connector is the ONLY token that moved.
        if (!arraysEqual(placedWithout, targetWithout)) continue;

        // Condition 2: short displacement (1-2 positions).
        const from = target.indexOf(connectorTile);
        const to = placed.indexOf(connectorTile);
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        const span = hi - lo;
        if (span < 1 || span > 2) continue;

        // Condition 3: the jumped tiles are a verb cluster (no nouns; at least
        // one pronoun or verb-like token). The jumped tiles are the entries
        // of ``target`` strictly between the connector's old and new slots.
        const jumped = target.slice(lo + 1, hi + 1).filter((i) => i !== connectorTile);
        if (jumped.length === 0) continue;
        const jumpedRaw = jumped.map((i) => tiles[i] ?? "");
        if (jumpedRaw.some((raw) => startsCapitalized(raw))) continue;
        const jumpedNorm = jumpedRaw.map(normToken);
        const looksLikeCluster = jumpedNorm.some(
            (tok) => MITTELFELD_PRONOUNS.has(tok) || isVerbLike(tok),
        );
        if (!looksLikeCluster) continue;

        return true;
    }
    return false;
}

/**
 * True iff the placed sequence (indices into ``tiles``) is accepted as
 * correct — exact canonical, an explicit ``accept_orderings`` permutation
 * (Mechanism A), or a conservative connector-move equivalent of any of those
 * target orders (Mechanism B).
 *
 * Grading is by COMPOSED TOKEN SEQUENCE, not by tile index (#1544): before
 * each comparison the placed indices are remapped onto the target's indices
 * by token text, so with duplicate tiles (two identical "die") the grade is
 * identical no matter which physical duplicate the learner tapped. Two
 * string-identical answers always score the same.
 *
 * @param placed - Indices into ``tiles`` in the learner's chosen order.
 * @param tiles - The exercise's canonical ordered tile texts.
 * @param acceptOrderings - Authored alternative orderings, or null/undefined.
 */
export function isWordTilesCorrect(
    placed: readonly number[],
    tiles: readonly string[],
    acceptOrderings: readonly (readonly number[])[] | null | undefined,
): boolean {
    const tileCount = tiles.length;
    if (placed.length !== tileCount) return false;

    const canonical = Array.from({length: tileCount}, (_, i) => i);
    const targets: readonly number[][] = [
        canonical,
        ...(acceptOrderings ?? []).map((o) => [...o]),
    ];

    for (const target of targets) {
        const remappedPlaced = remapPlacedByTokenText(placed, target, tiles);
        // Layers 1 + 2: exact token sequence (canonical / authored
        // alternative).
        if (arraysEqual(remappedPlaced, target)) return true;
        // Layer 3 (Mechanism B): conservative connector-move equivalence.
        if (equivalentByConnectorMove(remappedPlaced, target, tiles)) {
            return true;
        }
    }
    return false;
}
