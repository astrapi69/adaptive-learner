/**
 * Word-level visual diff between a user's answer and the correct answer.
 *
 * The output is a flat list of ``DiffToken`` records that a renderer can paint
 * inline. Adjacent delete+insert pairs collapse into a single ``replace``
 * token carrying the user's word as ``text`` and the expected word as
 * ``expected`` — this is what lets the UI show "you wrote X, expected Y"
 * inline instead of two stacked diff entries.
 *
 * Comparison is case- and accent-sensitive: at A1 in FR/ES/etc. those
 * differences matter for learning. NFC normalization on both sides ensures
 * visually-identical strings (composed vs decomposed Unicode) still compare
 * equal; everything else (case, accents, typos) becomes a replace.
 *
 * Phase 52A / v1.35.0 / P-126, Q-110.
 */

export type DiffOp = "equal" | "insert" | "delete" | "replace";

export interface DiffToken {
    /** The raw token text including a trailing space, except on the final token. */
    text: string;
    type: DiffOp;
    /** Only set when ``type === "replace"`` — the word the user should have written. */
    expected?: string;
}

/** Public entry point — see file docstring. */
export function tokenDiff(userAnswer: string, correctAnswer: string): DiffToken[] {
    const userNormalized = _normalizeWhitespace(userAnswer);
    const correctNormalized = _normalizeWhitespace(correctAnswer);

    if (!userNormalized && !correctNormalized) return [];
    if (!userNormalized) return [{ text: correctNormalized, type: "insert" }];
    if (!correctNormalized) return [{ text: userNormalized, type: "delete" }];

    const userWords = userNormalized.split(" ");
    const correctWords = correctNormalized.split(" ");
    const rawOps = _lcsDiff(userWords, correctWords);

    return _collapseReplaces(rawOps, userWords, correctWords);
}

function _normalizeWhitespace(raw: string): string {
    return raw.normalize("NFC").trim().replace(/\s+/g, " ");
}

interface RawOp {
    kind: "equal" | "insert" | "delete";
    /** Index into userWords for equal/delete ops. */
    userIdx?: number;
    /** Index into correctWords for equal/insert ops. */
    correctIdx?: number;
}

/** Standard LCS-backed diff over word arrays. Returns ops left-to-right. */
function _lcsDiff(userWords: string[], correctWords: string[]): RawOp[] {
    const m = userWords.length;
    const n = correctWords.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (userWords[i - 1] === correctWords[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    const rawOps: RawOp[] = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
        if (userWords[i - 1] === correctWords[j - 1]) {
            rawOps.unshift({ kind: "equal", userIdx: i - 1, correctIdx: j - 1 });
            i--;
            j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            rawOps.unshift({ kind: "delete", userIdx: i - 1 });
            i--;
        } else {
            rawOps.unshift({ kind: "insert", correctIdx: j - 1 });
            j--;
        }
    }
    while (i > 0) {
        rawOps.unshift({ kind: "delete", userIdx: i - 1 });
        i--;
    }
    while (j > 0) {
        rawOps.unshift({ kind: "insert", correctIdx: j - 1 });
        j--;
    }
    return rawOps;
}

/**
 * Pair adjacent delete+insert into ``replace`` tokens — UNLESS the entire diff
 * has zero ``equal`` ops, in which case the contract says "completely
 * different" → emit raw deletes then raw inserts without pairing.
 */
function _collapseReplaces(
    rawOps: RawOp[],
    userWords: string[],
    correctWords: string[],
): DiffToken[] {
    const hasEqualAnchor = rawOps.some((op) => op.kind === "equal");
    const tokens: DiffToken[] = [];
    let cursor = 0;
    while (cursor < rawOps.length) {
        const op = rawOps[cursor];
        if (op.kind === "equal") {
            tokens.push({ text: userWords[op.userIdx!] + " ", type: "equal" });
            cursor++;
            continue;
        }
        const runStart = cursor;
        while (
            cursor < rawOps.length &&
            (rawOps[cursor].kind === "delete" || rawOps[cursor].kind === "insert")
        ) {
            cursor++;
        }
        const runOps = rawOps.slice(runStart, cursor);
        const deletes = runOps.filter((o) => o.kind === "delete");
        const inserts = runOps.filter((o) => o.kind === "insert");
        const pairs = hasEqualAnchor ? Math.min(deletes.length, inserts.length) : 0;
        for (let p = 0; p < pairs; p++) {
            tokens.push({
                text: userWords[deletes[p].userIdx!] + " ",
                type: "replace",
                expected: correctWords[inserts[p].correctIdx!],
            });
        }
        for (let p = pairs; p < deletes.length; p++) {
            tokens.push({ text: userWords[deletes[p].userIdx!] + " ", type: "delete" });
        }
        for (let p = pairs; p < inserts.length; p++) {
            tokens.push({ text: correctWords[inserts[p].correctIdx!] + " ", type: "insert" });
        }
    }
    if (tokens.length > 0) {
        const last = tokens[tokens.length - 1];
        last.text = last.text.replace(/ $/, "");
    }
    return tokens;
}
