/**
 * Pure tests for the RenderContext helpers + deriveTopics
 * (Phase 49B / v1.32.0 / PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Mirrors the Python pytest cases in
 * ``plugins/adaptive-learner-plugin-learning-repo/tests/
 * test_context.py``. The cross-renderer parity test (49F)
 * pins byte-for-byte output equality on top of these
 * structural assertions.
 */

import {describe, expect, it} from "vitest";

import {
    buildRenderContext,
    deriveTopics,
    latestRating,
    methodDistribution,
    notesByKind,
    notesFor,
    ratingsFor,
    stepEvalsFor,
} from "./render-context";
import type {
    ProjectData,
    RatingData,
    SessionData,
    SessionNoteData,
    StepEvaluationData,
} from "./render-context";

// --- Fixtures ----------------------------------------------------------

const FIXED_RENDER_AT = "2026-05-27T12:00:00.000Z";

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
    return {
        id: "p-1",
        user_id: "u-1",
        topic: "Spanish",
        goal: "Conversational fluency",
        timeframe: "3 months",
        daily_minutes: 30,
        current_problem: null,
        active: true,
        kind: "standard",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
    return {
        id: "s-1",
        project_id: "p-1",
        method: "deductive",
        started_at: "2026-01-01T09:00:00Z",
        ended_at: "2026-01-01T09:30:00Z",
        cycle_step: 7,
        status: "completed",
        ...overrides,
    };
}

function makeRating(overrides: Partial<RatingData> = {}): RatingData {
    return {
        id: "r-1",
        session_id: "s-1",
        understanding: 4,
        stress: 2,
        method_fit: 4,
        notes: null,
        created_at: "2026-01-01T09:30:00Z",
        ...overrides,
    };
}

function makeNote(overrides: Partial<SessionNoteData> = {}): SessionNoteData {
    return {
        id: "n-1",
        session_id: "s-1",
        content: "Remembered the imperfect tense better than expected.",
        kind: "note",
        created_at: "2026-01-01T09:35:00Z",
        ...overrides,
    };
}

function makeStepEval(
    overrides: Partial<StepEvaluationData> = {},
): StepEvaluationData {
    return {
        id: "e-1",
        session_id: "s-1",
        from_step: 3,
        to_step: 4,
        advance: true,
        applied: true,
        confidence: 0.85,
        reason: "Demonstrated grasp of the new construction.",
        fallback_used: false,
        evaluated_at: "2026-01-01T09:15:00Z",
        ...overrides,
    };
}

// --- buildRenderContext ------------------------------------------------

describe("buildRenderContext", () => {
    it("returns the project + collections unchanged", () => {
        const project = makeProject();
        const sessions = [makeSession()];
        const ratings = [makeRating()];
        const ctx = buildRenderContext({
            project,
            sessions,
            ratings,
            step_evaluations: [],
            method_switches: [],
            notes: [],
            rendered_at: FIXED_RENDER_AT,
        });
        expect(ctx.project).toBe(project);
        expect(ctx.sessions).toBe(sessions);
        expect(ctx.ratings).toBe(ratings);
        expect(ctx.rendered_at).toBe(FIXED_RENDER_AT);
    });

    it("derives topics from sessions' cycle_topics", () => {
        const ctx = buildRenderContext({
            project: makeProject(),
            sessions: [
                makeSession({
                    id: "s-1",
                    cycle_topics: JSON.stringify([
                        {topic: "Greetings", summary: "ola/adios"},
                    ]),
                }),
            ],
            ratings: [],
            step_evaluations: [],
            method_switches: [],
            notes: [],
            rendered_at: FIXED_RENDER_AT,
        });
        expect(ctx.topics).toHaveLength(1);
        expect(ctx.topics[0].title).toBe("Greetings");
        expect(ctx.topics[0].order).toBe(1);
    });

    it("rendered_at defaults to now when omitted", () => {
        const before = new Date().toISOString();
        const ctx = buildRenderContext({
            project: makeProject(),
            sessions: [],
            ratings: [],
            step_evaluations: [],
            method_switches: [],
            notes: [],
        });
        const after = new Date().toISOString();
        expect(ctx.rendered_at >= before).toBe(true);
        expect(ctx.rendered_at <= after).toBe(true);
    });
});

// --- Helpers (pure) ----------------------------------------------------

describe("ratingsFor / latestRating", () => {
    it("filters per session and preserves order", () => {
        const ctx = buildRenderContext({
            project: makeProject(),
            sessions: [makeSession(), makeSession({id: "s-2"})],
            ratings: [
                makeRating({
                    id: "r-1",
                    session_id: "s-1",
                    created_at: "2026-01-01T09:30:00Z",
                }),
                makeRating({
                    id: "r-2",
                    session_id: "s-1",
                    created_at: "2026-01-01T10:00:00Z",
                }),
                makeRating({id: "r-3", session_id: "s-2"}),
            ],
            step_evaluations: [],
            method_switches: [],
            notes: [],
            rendered_at: FIXED_RENDER_AT,
        });
        const sessionOne = ratingsFor(ctx, "s-1");
        expect(sessionOne.map((r) => r.id)).toEqual(["r-1", "r-2"]);

        // ``latestRating`` returns the LAST in insertion
        // order — matches Python which uses rs[-1].
        expect(latestRating(ctx, "s-1")?.id).toBe("r-2");
        expect(latestRating(ctx, "s-2")?.id).toBe("r-3");
        expect(latestRating(ctx, "no-such")).toBeNull();
    });
});

describe("notesFor / notesByKind", () => {
    it("filters per session + per kind", () => {
        const ctx = buildRenderContext({
            project: makeProject(),
            sessions: [makeSession()],
            ratings: [],
            step_evaluations: [],
            method_switches: [],
            notes: [
                makeNote({id: "n-1", kind: "note"}),
                makeNote({id: "n-2", kind: "meta_learning"}),
                makeNote({id: "n-3", session_id: "s-2", kind: "note"}),
            ],
            rendered_at: FIXED_RENDER_AT,
        });
        expect(notesFor(ctx, "s-1").map((n) => n.id)).toEqual([
            "n-1",
            "n-2",
        ]);
        expect(notesByKind(ctx, "meta_learning").map((n) => n.id)).toEqual([
            "n-2",
        ]);
        expect(notesByKind(ctx, "note").map((n) => n.id)).toEqual([
            "n-1",
            "n-3",
        ]);
    });
});

describe("stepEvalsFor", () => {
    it("filters per session", () => {
        const ctx = buildRenderContext({
            project: makeProject(),
            sessions: [makeSession()],
            ratings: [],
            step_evaluations: [
                makeStepEval({id: "e-1"}),
                makeStepEval({id: "e-2", session_id: "s-2"}),
            ],
            method_switches: [],
            notes: [],
            rendered_at: FIXED_RENDER_AT,
        });
        expect(stepEvalsFor(ctx, "s-1").map((e) => e.id)).toEqual(["e-1"]);
        expect(stepEvalsFor(ctx, "s-2").map((e) => e.id)).toEqual(["e-2"]);
    });
});

describe("methodDistribution", () => {
    it("counts sessions per method, insertion order preserved", () => {
        const ctx = buildRenderContext({
            project: makeProject(),
            sessions: [
                makeSession({id: "s-1", method: "deductive"}),
                makeSession({id: "s-2", method: "inductive"}),
                makeSession({id: "s-3", method: "deductive"}),
                makeSession({id: "s-4", method: "deductive"}),
                makeSession({id: "s-5", method: "dialogic"}),
            ],
            ratings: [],
            step_evaluations: [],
            method_switches: [],
            notes: [],
            rendered_at: FIXED_RENDER_AT,
        });
        const dist = methodDistribution(ctx);
        expect(Array.from(dist.entries())).toEqual([
            ["deductive", 3],
            ["inductive", 1],
            ["dialogic", 1],
        ]);
    });
});

// --- deriveTopics (the load-bearing parity surface) ------------------

describe("deriveTopics", () => {
    it("returns empty when no sessions carry cycle_topics", () => {
        const sessions = [makeSession(), makeSession({id: "s-2"})];
        expect(deriveTopics(sessions)).toEqual([]);
    });

    it("first-appearance order across started_at ascending", () => {
        const sessions = [
            // Session B is older but seen second in input —
            // sort by started_at must put it first.
            makeSession({
                id: "s-a",
                started_at: "2026-01-02T09:00:00Z",
                cycle_topics: JSON.stringify([{topic: "Beta"}]),
            }),
            makeSession({
                id: "s-b",
                started_at: "2026-01-01T09:00:00Z",
                cycle_topics: JSON.stringify([{topic: "Alpha"}]),
            }),
        ];
        const topics = deriveTopics(sessions);
        expect(topics.map((t) => t.title)).toEqual(["Alpha", "Beta"]);
        expect(topics[0].order).toBe(1);
        expect(topics[1].order).toBe(2);
    });

    it("dedupes session ids + methods per topic", () => {
        const sessions = [
            makeSession({
                id: "s-1",
                method: "deductive",
                cycle_topics: JSON.stringify([
                    {topic: "Verbs"},
                    {topic: "Verbs"}, // same topic, same session
                ]),
            }),
            makeSession({
                id: "s-2",
                method: "inductive",
                started_at: "2026-01-02T09:00:00Z",
                cycle_topics: JSON.stringify([{topic: "Verbs"}]),
            }),
            makeSession({
                id: "s-3",
                method: "deductive",
                started_at: "2026-01-03T09:00:00Z",
                cycle_topics: JSON.stringify([{topic: "Verbs"}]),
            }),
        ];
        const topics = deriveTopics(sessions);
        expect(topics).toHaveLength(1);
        expect(topics[0].session_ids).toEqual(["s-1", "s-2", "s-3"]);
        // Methods preserve first-appearance order, dedupes
        // duplicates.
        expect(topics[0].methods).toEqual(["deductive", "inductive"]);
    });

    it("skips malformed JSON silently", () => {
        const sessions = [
            makeSession({
                id: "s-bad",
                cycle_topics: "not valid json",
            }),
            makeSession({
                id: "s-good",
                cycle_topics: JSON.stringify([{topic: "Good"}]),
            }),
        ];
        const topics = deriveTopics(sessions);
        expect(topics).toHaveLength(1);
        expect(topics[0].title).toBe("Good");
    });

    it("skips non-array cycle_topics", () => {
        const sessions = [
            makeSession({
                id: "s-1",
                cycle_topics: JSON.stringify({wrong: "shape"}),
            }),
        ];
        expect(deriveTopics(sessions)).toEqual([]);
    });

    it("skips entries without a topic field", () => {
        const sessions = [
            makeSession({
                id: "s-1",
                cycle_topics: JSON.stringify([
                    {summary: "no topic key here"},
                    {topic: ""}, // empty string
                    {topic: "   "}, // whitespace only
                    {topic: "Real"},
                ]),
            }),
        ];
        const topics = deriveTopics(sessions);
        expect(topics.map((t) => t.title)).toEqual(["Real"]);
    });

    it("trims whitespace around topic titles", () => {
        const sessions = [
            makeSession({
                id: "s-1",
                cycle_topics: JSON.stringify([
                    {topic: "  Spaces  "},
                    {topic: "Spaces"},
                ]),
            }),
        ];
        const topics = deriveTopics(sessions);
        // Both entries resolve to "Spaces" after trim →
        // single slice.
        expect(topics).toHaveLength(1);
        expect(topics[0].title).toBe("Spaces");
    });

    it("missing cycle_topics defaults to empty array (no crash)", () => {
        const sessions = [
            makeSession({id: "s-1"}), // cycle_topics undefined
        ];
        expect(deriveTopics(sessions)).toEqual([]);
    });
});
