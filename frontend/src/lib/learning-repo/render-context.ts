/**
 * RenderContext — every piece of data the learning-repo
 * renderers consume (Phase 49B / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Mirrors the Python ``RenderContext`` dataclass at
 * ``plugins/adaptive-learner-plugin-learning-repo/
 * adaptive_learner_learning_repo/context.py``. The TS shape is
 * what the parity test (49F) feeds the renderer; the Python
 * shape is what the Python renderer consumes from SQLAlchemy.
 * Both renderers produce the same Markdown when given the same
 * context.
 *
 * Loaded once per render by ``loadDexieContext`` (49B sibling
 * file) in Dexie mode. ApiStorage delegates to the backend
 * renderer end-point and never builds a context client-side,
 * so the loader is Dexie-specific by design.
 *
 * The methods on the Python dataclass are TS free functions
 * here, taking the context as the first arg. Pure-functional
 * keeps renderer testing simple (build a fixture object,
 * pass it to the helper, assert the result) and matches the
 * functional bent of the rest of the frontend lib/.
 */

// --- Data shapes (mirror the backend SQLAlchemy models) ---------------

export interface ProjectData {
    id: string;
    user_id: string;
    topic: string;
    goal: string;
    timeframe: string;
    daily_minutes: number;
    current_problem: string | null;
    active: boolean;
    kind: string;
    created_at: string;
    updated_at: string;
}

export interface SessionData {
    id: string;
    project_id: string;
    method: string;
    started_at: string;
    ended_at: string | null;
    cycle_step: number;
    status: string;
    /** Defaults to 1 when absent. Dexie-mode sessions never
     *  write this column; the API mode does. */
    cycle_count?: number;
    /** JSON-encoded array of ``{cycle, topic, summary, ...}``
     *  entries from the v1.4.0 auto-loop. Defaults to ``"[]"``
     *  when absent; ``deriveTopics`` treats malformed JSON as
     *  empty. Dexie-mode sessions never write this column. */
    cycle_topics?: string;
}

export interface RatingData {
    id: string;
    session_id: string;
    /** 1-5 scale; renderer scales x2 for the /10 display per
     *  Article-1 § 8 thresholds. */
    understanding: number;
    /** 1-5 scale. */
    stress: number;
    /** 1-5 scale; renderer scales x2 for the /10 "Transfer"
     *  display column. */
    method_fit: number;
    notes: string | null;
    created_at: string;
}

export interface StepEvaluationData {
    id: string;
    session_id: string;
    from_step: number;
    to_step: number;
    advance: boolean;
    applied: boolean;
    confidence: number;
    reason: string;
    fallback_used: boolean;
    evaluated_at: string;
}

export interface MethodSwitchData {
    id: string;
    project_id: string;
    from_method: string;
    to_method: string;
    reason: string;
    switched_at: string;
}

export interface SessionNoteData {
    id: string;
    session_id: string;
    content: string;
    /** Free-text discriminator: ``"note"`` (default,
     *  free-form) or ``"meta_learning"`` (Article-3
     *  "Meta-Learning Insight"; surfaced as its own
     *  cheatsheet section). */
    kind: string;
    created_at: string;
}

// --- TopicSlice (derived from sessions' cycle_topics) -----------------

/**
 * One distinct subtopic the project's sessions traversed.
 * ``order`` is the appearance order across the project
 * (oldest first). ``session_ids`` pin the sessions that
 * touched the topic; ``methods`` is the set of methods used,
 * first-appearance order preserved.
 */
export interface TopicSlice {
    order: number;
    title: string;
    session_ids: readonly string[];
    methods: readonly string[];
}

// --- Full context -----------------------------------------------------

export interface RenderContext {
    project: ProjectData;
    sessions: readonly SessionData[];
    ratings: readonly RatingData[];
    step_evaluations: readonly StepEvaluationData[];
    method_switches: readonly MethodSwitchData[];
    notes: readonly SessionNoteData[];
    topics: readonly TopicSlice[];
    /** ISO datetime captured at context construction. The
     *  Python side stamps with ``datetime.now(UTC)``; for
     *  renderer parity tests the caller pins a fixed value. */
    rendered_at: string;
}

// --- Helpers (pure functions of the context) --------------------------

export function ratingsFor(
    ctx: RenderContext,
    sessionId: string,
): RatingData[] {
    return ctx.ratings.filter((r) => r.session_id === sessionId);
}

export function latestRating(
    ctx: RenderContext,
    sessionId: string,
): RatingData | null {
    const rs = ratingsFor(ctx, sessionId);
    return rs.length === 0 ? null : rs[rs.length - 1];
}

export function notesFor(
    ctx: RenderContext,
    sessionId: string,
): SessionNoteData[] {
    return ctx.notes.filter((n) => n.session_id === sessionId);
}

export function stepEvalsFor(
    ctx: RenderContext,
    sessionId: string,
): StepEvaluationData[] {
    return ctx.step_evaluations.filter((e) => e.session_id === sessionId);
}

export function notesByKind(
    ctx: RenderContext,
    kind: string,
): SessionNoteData[] {
    return ctx.notes.filter((n) => n.kind === kind);
}

/**
 * Sessions-per-method count. Matches Python's
 * ``method_distribution`` dict (preserves insertion order =
 * first-appearance across the session iteration order).
 */
export function methodDistribution(ctx: RenderContext): Map<string, number> {
    const dist = new Map<string, number>();
    for (const s of ctx.sessions) {
        dist.set(s.method, (dist.get(s.method) ?? 0) + 1);
    }
    return dist;
}

// --- Topic derivation --------------------------------------------------

/**
 * Build TopicSlice list from sessions' ``cycle_topics`` JSON.
 *
 * Each session's ``cycle_topics`` is a JSON-encoded array of
 * per-cycle ``{topic, summary, ...}`` objects written by the
 * v1.4.0 auto-loop. Distinct topic strings become numbered
 * slices in order of first appearance across the session
 * timeline (oldest started_at first).
 *
 * Sessions whose ``cycle_topics`` is empty / missing /
 * malformed JSON are skipped silently — they contribute their
 * method/id to other surfaces but don't create a topic slice.
 *
 * Mirrors the Python ``derive_topics`` function 1:1 — the
 * parity test (49F) pins byte-for-byte equality.
 */
export function deriveTopics(
    sessions: readonly SessionData[],
): readonly TopicSlice[] {
    // Stable sort by started_at ascending. The compare is
    // string-vs-string for ISO timestamps; lexicographic order
    // matches chronological order for the YYYY-MM-DD... shape.
    const sorted = [...sessions].sort((a, b) =>
        a.started_at.localeCompare(b.started_at),
    );

    const orderedTitles: string[] = [];
    const titleToSessions = new Map<string, string[]>();
    const titleToMethods = new Map<string, string[]>();

    for (const session of sorted) {
        const raw = session.cycle_topics ?? "[]";
        let cycles: unknown;
        try {
            cycles = JSON.parse(raw);
        } catch {
            continue;
        }
        if (!Array.isArray(cycles)) {
            continue;
        }
        for (const cycle of cycles) {
            if (cycle === null || typeof cycle !== "object") {
                continue;
            }
            const titleRaw = (cycle as Record<string, unknown>).topic;
            if (typeof titleRaw !== "string" || titleRaw.trim() === "") {
                continue;
            }
            const title = titleRaw.trim();
            if (!titleToSessions.has(title)) {
                orderedTitles.push(title);
                titleToSessions.set(title, []);
                titleToMethods.set(title, []);
            }
            const sessionIds = titleToSessions.get(title);
            const methods = titleToMethods.get(title);
            if (sessionIds && !sessionIds.includes(session.id)) {
                sessionIds.push(session.id);
            }
            if (methods && !methods.includes(session.method)) {
                methods.push(session.method);
            }
        }
    }

    return orderedTitles.map((title, i) => ({
        order: i + 1,
        title,
        session_ids: titleToSessions.get(title) ?? [],
        methods: titleToMethods.get(title) ?? [],
    }));
}

// --- Builder (pure transform on raw row tuples) -----------------------

/**
 * Build a RenderContext from raw row data. Pure transform —
 * no I/O. The Dexie loader (``loadDexieContext``) queries
 * IndexedDB and calls this; the parity test (49F) loads a
 * JSON fixture and calls this directly. Single source of
 * truth for the "data tuple -> context" step.
 *
 * ``rendered_at`` defaults to ``new Date().toISOString()`` but
 * can be pinned for deterministic tests.
 */
export interface RenderContextInputs {
    project: ProjectData;
    sessions: readonly SessionData[];
    ratings: readonly RatingData[];
    step_evaluations: readonly StepEvaluationData[];
    method_switches: readonly MethodSwitchData[];
    notes: readonly SessionNoteData[];
    rendered_at?: string;
}

export function buildRenderContext(
    inputs: RenderContextInputs,
): RenderContext {
    return {
        project: inputs.project,
        sessions: inputs.sessions,
        ratings: inputs.ratings,
        step_evaluations: inputs.step_evaluations,
        method_switches: inputs.method_switches,
        notes: inputs.notes,
        topics: deriveTopics(inputs.sessions),
        rendered_at: inputs.rendered_at ?? new Date().toISOString(),
    };
}
