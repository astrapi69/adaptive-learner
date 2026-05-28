/**
 * Adaptive-lesson-generator domain types (Phase 53A / EXP-013).
 *
 * Pure data shapes consumed by the error analyzer + exercise
 * pool + lesson generator. Mirrored on the Python side by
 * ``backend/app/services/adaptive_lesson.py``. The fixture at
 * ``tests/fixtures/adaptive-lesson-parity/`` pins both sides
 * to byte-identical output.
 */

/** One element promoted from the raw ``ElementError`` row, with
 *  the analyzer's two computed fields (``recency_weight`` and
 *  ``priority_score``) attached. The generator's
 *  ``suggested_focus`` and ``prioritized_elements`` arrays both
 *  hold these. */
export interface PrioritizedElement {
    element_key: string;
    set_id: string;
    lesson_id: string;
    exercise_id: string;
    element_type: string;
    error_count: number;
    correct_streak: number;
    last_error_at: string | null;
    last_attempt_at: string;
    user_answer: string;
    correct_answer: string;
    recency_weight: number;
    priority_score: number;
}

/** One detected cluster of related errors. The label is the
 *  cluster key (e.g. ``"vocabulary"`` for an element_type
 *  cluster, ``"02-numbers.json"`` for a lesson cluster). The
 *  ``cluster_type`` discriminator tells the generator how to
 *  interpret the label. */
export interface ErrorCluster {
    cluster_type: "element_type" | "lesson";
    key: string;
    element_keys: string[];
    error_count_total: number;
}

/** Full output of ``analyzeErrors`` — what the lesson generator
 *  + the Dashboard widget both consume. */
export interface ErrorAnalysis {
    /** All active (non-mastered, error_count > 0) elements
     *  sorted by ``priority_score`` desc. */
    prioritized_elements: PrioritizedElement[];
    /** Pattern detections, error_count_total desc. */
    error_clusters: ErrorCluster[];
    /** ``element_type`` → share of total errors (0..1, sums to
     *  ~1.0). Rounded to 3 decimals so the parity goldens stay
     *  byte-equal across Python/TypeScript floats. */
    weakness_profile: Record<string, number>;
    /** Top-N from ``prioritized_elements`` (default N=3). */
    suggested_focus: PrioritizedElement[];
    /** Sum of ``error_count`` across active elements. */
    total_errors: number;
    /** Active elements participating in the analysis. */
    active_elements: number;
}

export interface AnalyzeOpts {
    /** ISO-8601 string for "now". When omitted, the function
     *  uses ``new Date()`` at call time — for deterministic
     *  tests, pin this. */
    now?: string;
    /** Number of items in ``suggested_focus``. Default 3. */
    focusCount?: number;
}
