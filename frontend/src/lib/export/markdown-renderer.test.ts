/**
 * Tests for the export Markdown renderer (Phase 16B).
 *
 * Covers all three export types (progress report, session detail,
 * curriculum overview), language switching (DE / EN), empty / non-
 * empty data paths, and the small set of formatting rules
 * (star ratings, percentages, table rendering).
 */

import {describe, expect, it} from "vitest";

import type {
    CurriculumOverview,
    ProgressReport,
    SessionDetail,
} from "../../storage/backup/export-builder";
import {
    exportFilename,
    renderMarkdown,
} from "./markdown-renderer";

function envelope<T extends string>(
    type: T,
): {
    format: string;
    version: string;
    type: T;
    generated_at: string;
    app_version: string;
} {
    return {
        format: "adaptive-learner-export",
        version: "1.3.0",
        type,
        generated_at: "2026-05-20T10:00:00.000Z",
        app_version: "1.3.0",
    };
}

function emptyProgressReport(lang = "de"): ProgressReport {
    return {
        ...envelope("progress_report"),
        lang,
        user: {id: "u1", name: "Aster", language: lang},
        profile: null,
        projects: [],
        recent_sessions: [],
        step_evaluation_insights: null,
        extractions: [],
    };
}

describe("renderMarkdown - progress_report", () => {
    it("uses the DE title when lang=de", () => {
        const md = renderMarkdown(emptyProgressReport("de"));
        expect(md).toMatch(/^# Lernfortschritt/);
        expect(md).toContain("Lernende:r");
    });

    it("uses the EN title when lang=en", () => {
        const md = renderMarkdown(emptyProgressReport("en"));
        expect(md).toMatch(/^# Learning Progress/);
        expect(md).toContain("Learner");
    });

    it("renders the no-profile fallback when profile is null", () => {
        const md = renderMarkdown(emptyProgressReport("en"));
        expect(md).toContain("No assessment yet");
    });

    it("renders the profile + dominant method when present", () => {
        const report: ProgressReport = {
            ...emptyProgressReport("en"),
            profile: {
                deductive: 0.7,
                inductive: 0.4,
                error_based: 0.2,
                dialogic: 0.6,
                contextual: 0.5,
                ai_adaptive: 0.3,
                dominant_method: "deductive",
                assessed_at: "2026-05-01T00:00:00.000Z",
                version: 1,
            },
        };
        const md = renderMarkdown(report);
        expect(md).toContain("Deductive");
        expect(md).toContain("Last assessed");
        expect(md).toContain("70%");
    });

    it("renders a no-projects fallback", () => {
        const md = renderMarkdown(emptyProgressReport("de"));
        expect(md).toContain("Noch keine Lernprojekte angelegt.");
    });

    it("renders project summary + method distribution table", () => {
        const report: ProgressReport = {
            ...emptyProgressReport("en"),
            projects: [
                {
                    id: "p1",
                    topic: "Bayes",
                    goal: "Master it",
                    timeframe: "2 weeks",
                    daily_minutes: 30,
                    current_problem: null,
                    active: true,
                    created_at: "2026-04-01T00:00:00.000Z",
                    session_count: 1,
                    total_minutes: 30,
                    mean_understanding: 0.8,
                    mean_stress: 0.2,
                    method_distribution: [
                        {method: "deductive", count: 1, percentage: 100},
                        {method: "inductive", count: 0, percentage: 0},
                        {method: "error_based", count: 0, percentage: 0},
                        {method: "dialogic", count: 0, percentage: 0},
                        {method: "contextual", count: 0, percentage: 0},
                        {method: "ai_adaptive", count: 0, percentage: 0},
                    ],
                    method_switches: [],
                },
            ],
        };
        const md = renderMarkdown(report);
        expect(md).toContain("### Bayes");
        expect(md).toContain("80%");
        expect(md).toContain("Method distribution");
        expect(md).toContain("| Deductive | 1 | 100% |");
        expect(md).toContain("No method switches in this project.");
    });

    it("renders recent-sessions table with rating column", () => {
        const report: ProgressReport = {
            ...emptyProgressReport("en"),
            recent_sessions: [
                {
                    id: "s1",
                    project_id: "p1",
                    project_topic: "Bayes",
                    method: "deductive",
                    started_at: "2026-05-01T10:00:00.000Z",
                    ended_at: "2026-05-01T10:30:00.000Z",
                    duration_minutes: 30,
                    cycle_step: 7,
                    status: "completed",
                    rating: {
                        understanding: 4,
                        stress: 2,
                        method_fit: 5,
                        notes: null,
                        created_at: "2026-05-01T10:30:00.000Z",
                    },
                },
            ],
        };
        const md = renderMarkdown(report);
        expect(md).toContain("Recent sessions");
        expect(md).toContain("4/5");
    });

    it("escapes pipe characters in session-table cells", () => {
        const report: ProgressReport = {
            ...emptyProgressReport("en"),
            recent_sessions: [
                {
                    id: "s1",
                    project_id: "p1",
                    project_topic: "Topic | with pipe",
                    method: "deductive",
                    started_at: "2026-05-01T10:00:00.000Z",
                    ended_at: "2026-05-01T10:30:00.000Z",
                    duration_minutes: 30,
                    cycle_step: 7,
                    status: "completed",
                    rating: null,
                },
            ],
        };
        const md = renderMarkdown(report);
        expect(md).toContain("Topic \\| with pipe");
    });

    it("renders step evaluation insights when present", () => {
        const report: ProgressReport = {
            ...emptyProgressReport("en"),
            step_evaluation_insights: [
                {
                    step: 3,
                    count: 5,
                    advance_count: 3,
                    repeat_count: 1,
                    deferred_count: 1,
                    advance_rate: 0.6,
                    mean_confidence: 0.75,
                },
            ],
        };
        const md = renderMarkdown(report);
        expect(md).toContain("Step evaluations");
        expect(md).toContain("60%");
        expect(md).toContain("75%");
        expect(md).toContain("3. Error");
    });

    it("renders extractions section with structured analysis fields", () => {
        const report: ProgressReport = {
            ...emptyProgressReport("en"),
            extractions: [
                {
                    id: "e1",
                    title: "Bayes Tutoring",
                    source: "claude",
                    message_count: 12,
                    imported_at: "2026-05-02T00:00:00.000Z",
                    project_id: "p1",
                    topic_tag: "bayes",
                    analysis: {
                        topic: "Bayes inference",
                        user_level: "intermediate",
                        subtopics: ["priors", "posteriors"],
                        strengths: ["good math basics"],
                        weaknesses: ["mixes priors"],
                        recommended_method: "deductive",
                        recommended_focus: "fix prior intuition",
                        summary: "Strong basics, mixes\npriors and posteriors",
                        suggested_curriculum: [
                            {title: "Priors deep dive", description: "Conjugate priors", priority: 1},
                        ],
                    },
                },
            ],
        };
        const md = renderMarkdown(report);
        expect(md).toContain("### Bayes Tutoring");
        // Structured renderers fired instead of a JSON dump
        expect(md).toContain("**Detected topic:** Bayes inference");
        expect(md).toContain("**Level:** Intermediate");
        expect(md).toContain("- priors");
        expect(md).toContain("- mixes priors");
        expect(md).toContain("**Recommended method:** Deductive");
        expect(md).toContain("**Recommended focus:** fix prior intuition");
        expect(md).toContain("> Strong basics, mixes");
        expect(md).toContain("> priors and posteriors");
        expect(md).toContain("- **Priors deep dive**");
        expect(md).toContain("Linked project:** p1");
        // Should NOT emit a JSON appendix when all fields were consumed
        expect(md).not.toContain("```json");
    });

    it("renders unknown analysis fields as a JSON appendix", () => {
        const report: ProgressReport = {
            ...emptyProgressReport("en"),
            extractions: [
                {
                    id: "e1",
                    title: "X",
                    source: "claude",
                    message_count: 1,
                    imported_at: "2026-05-02T00:00:00.000Z",
                    project_id: null,
                    topic_tag: null,
                    analysis: {custom_field: "value", topic: "T"},
                },
            ],
        };
        const md = renderMarkdown(report);
        expect(md).toContain("**Detected topic:** T");
        // The unknown field falls into the JSON appendix
        expect(md).toContain("```json");
        expect(md).toContain('"custom_field"');
    });

    it("envelope footer carries the timestamp + app version", () => {
        const md = renderMarkdown(emptyProgressReport("en"));
        expect(md).toContain("Generated at: 2026-05-20 10:00 UTC");
        expect(md).toContain("App version: 1.3.0");
    });
});

describe("renderMarkdown - session_detail", () => {
    function sessionPayload(overrides: Partial<SessionDetail> = {}): SessionDetail {
        return {
            ...envelope("session_detail"),
            lang: "en",
            session: {
                id: "s1",
                project_id: "p1",
                method: "deductive",
                started_at: "2026-05-01T10:00:00.000Z",
                ended_at: "2026-05-01T10:30:00.000Z",
                duration_minutes: 30,
                cycle_step: 7,
                status: "completed",
            },
            project: {id: "p1", topic: "Bayes", goal: "Master it", timeframe: "2 weeks"},
            messages: [],
            rating: null,
            step_evaluations: [],
            ...overrides,
        };
    }

    it("renders meta with method label + duration", () => {
        const md = renderMarkdown(sessionPayload());
        expect(md).toContain("# Session Detail");
        expect(md).toContain("Deductive");
        expect(md).toContain("30 min");
    });

    it("renders transcript as blockquoted role + body", () => {
        const md = renderMarkdown(
            sessionPayload({
                messages: [
                    {
                        role: "user",
                        content: "Hi\nthere",
                        created_at: "2026-05-01T10:00:00.000Z",
                    },
                    {
                        role: "assistant",
                        content: "Hello!",
                        created_at: "2026-05-01T10:01:00.000Z",
                    },
                ],
            }),
        );
        expect(md).toContain("### Learner");
        expect(md).toContain("> Hi");
        expect(md).toContain("> there");
        expect(md).toContain("### AI");
        expect(md).toContain("> Hello!");
    });

    it("renders star rating when present", () => {
        const md = renderMarkdown(
            sessionPayload({
                rating: {
                    understanding: 4,
                    stress: 2,
                    method_fit: 5,
                    notes: "Felt clear",
                    created_at: "2026-05-01T10:30:00.000Z",
                },
            }),
        );
        expect(md).toContain("★★★★☆");
        expect(md).toContain("4/5");
        expect(md).toContain("> Felt clear");
    });

    it("renders no-rating fallback when rating is null", () => {
        const md = renderMarkdown(sessionPayload());
        expect(md).toContain("Session was not rated.");
    });

    it("renders step-evaluations table when present", () => {
        const md = renderMarkdown(
            sessionPayload({
                step_evaluations: [
                    {
                        from_step: 1,
                        to_step: 2,
                        advance: true,
                        confidence: 0.85,
                        applied: true,
                        fallback_used: false,
                        reason: "Step understood",
                        evaluated_at: "2026-05-01T10:05:00.000Z",
                    },
                ],
            }),
        );
        expect(md).toContain("1. Input");
        expect(md).toContain("2. Attempt");
        expect(md).toContain("85%");
        expect(md).toContain("Applied");
        expect(md).toContain("Step understood");
    });
});

describe("renderMarkdown - curriculum_overview", () => {
    function curriculumPayload(
        overrides: Partial<CurriculumOverview> = {},
    ): CurriculumOverview {
        return {
            ...envelope("curriculum_overview"),
            lang: "en",
            curriculum: {
                id: "c1",
                title: "Spanish Grammar",
                description: "Subjunctive deep dive",
                language: "en",
                created_at: "2026-04-01T00:00:00.000Z",
                updated_at: "2026-05-01T00:00:00.000Z",
            },
            topics: [],
            lessons: [],
            ...overrides,
        };
    }

    it("renders the title + description", () => {
        const md = renderMarkdown(curriculumPayload());
        expect(md).toContain("# Curriculum Overview: Spanish Grammar");
        expect(md).toContain("Subjunctive deep dive");
    });

    it("indents topics by depth", () => {
        const md = renderMarkdown(
            curriculumPayload({
                topics: [
                    {
                        id: "t1",
                        parent_id: null,
                        title: "Root",
                        description: null,
                        order_index: 0,
                        depth: 0,
                    },
                    {
                        id: "t2",
                        parent_id: "t1",
                        title: "Child",
                        description: "Inner topic",
                        order_index: 0,
                        depth: 1,
                    },
                ],
            }),
        );
        expect(md).toContain("- **Root**");
        expect(md).toContain("  - **Child**");
        expect(md).toContain("    - Inner topic");
    });

    it("renders lessons as sections", () => {
        const md = renderMarkdown(
            curriculumPayload({
                lessons: [
                    {id: "l1", title: "Intro", content: "Hello world", order_index: 0},
                ],
            }),
        );
        expect(md).toContain("### Intro");
        expect(md).toContain("Hello world");
    });

    it("renders no-topics / no-lessons fallback", () => {
        const md = renderMarkdown(curriculumPayload());
        expect(md).toContain("No topics in this curriculum.");
        expect(md).toContain("No lessons in this curriculum.");
    });
});

describe("exportFilename", () => {
    it("produces a slug-date based name with the given extension", () => {
        const name = exportFilename(emptyProgressReport("en"), "md");
        expect(name).toBe("adaptive-learner-progress-report-2026-05-20.md");
    });

    it("uses the chosen extension", () => {
        const name = exportFilename(emptyProgressReport("en"), "pdf");
        expect(name).toBe("adaptive-learner-progress-report-2026-05-20.pdf");
    });
});
