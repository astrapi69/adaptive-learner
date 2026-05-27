/**
 * Article-1 § 8 exit-threshold logic — single source of truth
 * (Phase 49C / v1.32.0 / PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Mirrors the Python ``thresholds.py`` module at
 * ``plugins/.../learning-repo/adaptive_learner_learning_repo/
 * thresholds.py``. Both halves (Python git-tagger + TS
 * stats renderer) consume the same predicate so the row
 * pinned in LEARNING_STATS.md is the one the git tagger
 * would fire on.
 *
 * The threshold (per Article 1 § 8 of *Von Theorie zur
 * Praxis*): **Understanding ≥ 9/10 AND Transfer ≥ 8/10
 * stable over 2 consecutive cycles.** ``SessionRating
 * .understanding`` and ``method_fit`` are stored 1-5; the
 * renderer scales x2 to /10 for display.
 */

import {latestRating} from "./render-context";
import type {RenderContext} from "./render-context";

/** Per-session bar — must hold for THIS session AND the
 *  immediately preceding session for the row to be pinned. */
export const UNDERSTANDING_OUT_OF_TEN_MIN = 9;
export const TRANSFER_OUT_OF_TEN_MIN = 8;

/**
 * True iff the latest rating on ``sessionId`` clears the
 * per-session understanding + transfer bar.
 */
export function meetsPerSessionBar(
    sessionId: string,
    ctx: RenderContext,
): boolean {
    const rating = latestRating(ctx, sessionId);
    if (rating === null) {
        return false;
    }
    const understandingTen = rating.understanding * 2;
    const transferTen = rating.method_fit * 2;
    return (
        understandingTen >= UNDERSTANDING_OUT_OF_TEN_MIN &&
        transferTen >= TRANSFER_OUT_OF_TEN_MIN
    );
}

/**
 * Indices into the started_at-sorted session list where the
 * Article-1 § 8 exit threshold is met (this session AND the
 * immediately preceding session both clear the per-session
 * bar). Session 0 never qualifies — the "stable over 2
 * cycles" rule needs a predecessor.
 */
export function exitThresholdIndices(ctx: RenderContext): Set<number> {
    const sorted = [...ctx.sessions].sort((a, b) =>
        a.started_at.localeCompare(b.started_at),
    );
    const pinned = new Set<number>();
    for (let i = 0; i < sorted.length; i++) {
        if (i === 0) continue;
        const session = sorted[i];
        const prev = sorted[i - 1];
        if (
            meetsPerSessionBar(session.id, ctx) &&
            meetsPerSessionBar(prev.id, ctx)
        ) {
            pinned.add(i);
        }
    }
    return pinned;
}

/**
 * Position (1-indexed) of the most recent session where the
 * exit threshold was reached, or ``null`` if no session
 * qualifies. The git-tagger consumes this; the TS renderer
 * doesn't currently surface it but the helper exists for
 * future parity work + the parity test.
 */
export function latestExitThresholdCycle(
    ctx: RenderContext,
): number | null {
    const indices = exitThresholdIndices(ctx);
    if (indices.size === 0) {
        return null;
    }
    return Math.max(...indices) + 1;
}
