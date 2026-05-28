/**
 * Error analyzer for the adaptive lesson generator
 * (Phase 53A / v1.36.0 / EXP-013 / P-131, P-133, P-134).
 *
 * Reads an array of ``ElementError`` rows and produces an
 * ``ErrorAnalysis`` carrying the data the generator needs:
 *
 *   - ``prioritized_elements``: every active element sorted by
 *     ``priority_score`` (``error_count * recency_weight``)
 *   - ``error_clusters``: 3+ errors sharing the same
 *     ``element_type`` or ``lesson_id``
 *   - ``weakness_profile``: per-element_type share of total errors
 *   - ``suggested_focus``: top-N (default 3) for the Dashboard
 *
 * Pure, deterministic, no I/O. The Python mirror at
 * ``backend/app/services/adaptive_lesson.py`` produces
 * byte-identical output for the same input; the parity test
 * at ``error-analyzer.parity.test.ts`` pins both implementations.
 *
 * Mastered elements (``mastered === true``) AND zero-error rows
 * (``error_count === 0``) are excluded — the generator targets
 * active weaknesses only.
 *
 * Recency bands (Phase 53 spec):
 *   - last error < 1 day ago     →  weight 1.0
 *   - last error 1–2 days ago    →  weight 0.8
 *   - last error 2–7 days ago    →  weight 0.5
 *   - last error >= 7 days ago   →  weight 0.3
 *   - never errored (last_error_at null) → weight 0.3
 *
 * The 0.3 floor for "never errored" handles a defensive case
 * — a row with ``error_count > 0`` but ``last_error_at`` null
 * shouldn't exist in practice, but the analyzer degrades
 * gracefully instead of crashing.
 */

import type {ElementError} from "../../storage/types";
import type {
    AnalyzeOpts,
    ErrorAnalysis,
    ErrorCluster,
    PrioritizedElement,
} from "./types";

const DEFAULT_FOCUS_COUNT = 3;
const CLUSTER_MIN = 3;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Maps an age-in-days to a recency weight per the Phase 53
 *  spec. Exported so tests + the Python parity fixtures can pin
 *  the band boundaries explicitly. */
export function recencyWeight(
    lastErrorAt: string | null,
    now: Date,
): number {
    if (!lastErrorAt) return 0.3;
    const ts = Date.parse(lastErrorAt);
    if (Number.isNaN(ts)) return 0.3;
    const ageDays = (now.getTime() - ts) / MS_PER_DAY;
    if (ageDays < 1) return 1.0;
    if (ageDays < 2) return 0.8;
    if (ageDays < 7) return 0.5;
    return 0.3;
}

function _prioritize(err: ElementError, now: Date): PrioritizedElement {
    const weight = recencyWeight(err.last_error_at, now);
    return {
        element_key: err.element_key,
        set_id: err.set_id,
        lesson_id: err.lesson_id,
        exercise_id: err.exercise_id,
        element_type: err.element_type || "vocabulary",
        error_count: err.error_count,
        correct_streak: err.correct_streak,
        last_error_at: err.last_error_at,
        last_attempt_at: err.last_attempt_at,
        user_answer: err.user_answer,
        correct_answer: err.correct_answer,
        recency_weight: weight,
        priority_score: err.error_count * weight,
    };
}

/** Sort prioritized elements by score desc with a stable
 *  tie-break: more recent ``last_attempt_at`` first, then
 *  alphabetical ``element_key`` to keep cross-language parity
 *  deterministic when timestamps tie. */
function _comparePrioritized(
    a: PrioritizedElement,
    b: PrioritizedElement,
): number {
    if (b.priority_score !== a.priority_score) {
        return b.priority_score - a.priority_score;
    }
    if (a.last_attempt_at !== b.last_attempt_at) {
        return a.last_attempt_at < b.last_attempt_at ? 1 : -1;
    }
    return a.element_key < b.element_key ? -1 : 1;
}

function _detectClusters(active: ElementError[]): ErrorCluster[] {
    const out: ErrorCluster[] = [];
    out.push(..._clusterBy(active, "element_type", (e) => e.element_type || "vocabulary"));
    out.push(..._clusterBy(active, "lesson", (e) => e.lesson_id));
    out.sort((a, b) => {
        if (b.error_count_total !== a.error_count_total) {
            return b.error_count_total - a.error_count_total;
        }
        if (a.cluster_type !== b.cluster_type) {
            return a.cluster_type < b.cluster_type ? -1 : 1;
        }
        return a.key < b.key ? -1 : 1;
    });
    return out;
}

function _clusterBy(
    active: ElementError[],
    clusterType: ErrorCluster["cluster_type"],
    keyOf: (e: ElementError) => string,
): ErrorCluster[] {
    const groups = new Map<string, ElementError[]>();
    for (const err of active) {
        const k = keyOf(err);
        const bucket = groups.get(k);
        if (bucket) bucket.push(err);
        else groups.set(k, [err]);
    }
    const out: ErrorCluster[] = [];
    for (const [key, errors] of groups) {
        if (errors.length < CLUSTER_MIN) continue;
        const sortedKeys = errors
            .map((e) => e.element_key)
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        out.push({
            cluster_type: clusterType,
            key,
            element_keys: sortedKeys,
            error_count_total: errors.reduce(
                (sum, e) => sum + e.error_count,
                0,
            ),
        });
    }
    return out;
}

function _computeWeaknessProfile(
    active: ElementError[],
): Record<string, number> {
    const totals = new Map<string, number>();
    let grandTotal = 0;
    for (const err of active) {
        const type = err.element_type || "vocabulary";
        totals.set(type, (totals.get(type) ?? 0) + err.error_count);
        grandTotal += err.error_count;
    }
    if (grandTotal === 0) return {};
    const profile: Record<string, number> = {};
    const sortedKeys = Array.from(totals.keys()).sort();
    for (const key of sortedKeys) {
        const share = (totals.get(key) ?? 0) / grandTotal;
        profile[key] = Math.round(share * 1000) / 1000;
    }
    return profile;
}

/** Run the analysis. Pure function — same input + same ``now``
 *  always produces the same output. ``opts.now`` MUST be passed
 *  in tests to keep the result deterministic. */
export function analyzeErrors(
    elementErrors: readonly ElementError[],
    opts: AnalyzeOpts = {},
): ErrorAnalysis {
    const now = opts.now ? new Date(opts.now) : new Date();
    const focusCount = opts.focusCount ?? DEFAULT_FOCUS_COUNT;
    const active = elementErrors.filter(
        (e) => !e.mastered && e.error_count > 0,
    );
    const prioritized = active.map((e) => _prioritize(e, now));
    prioritized.sort(_comparePrioritized);
    const clusters = _detectClusters(active);
    const weaknessProfile = _computeWeaknessProfile(active);
    const totalErrors = active.reduce(
        (sum, e) => sum + e.error_count,
        0,
    );
    return {
        prioritized_elements: prioritized,
        error_clusters: clusters,
        weakness_profile: weaknessProfile,
        suggested_focus: prioritized.slice(0, focusCount),
        total_errors: totalErrors,
        active_elements: active.length,
    };
}
