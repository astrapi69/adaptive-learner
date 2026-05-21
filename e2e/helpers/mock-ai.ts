/**
 * Shared E2E helper for mocking AI responses end-to-end
 * (Phase 28A / v1.15.0).
 *
 * Adaptive Learner orchestrates AI server-side: the browser
 * POSTs to ``/api/plugins/session/{id}/message`` and the
 * route calls ``ai_complete`` via pluggy. Without mocks, the
 * E2E backend has no API keys and the route returns a null
 * ``assistant_message`` plus an ``ai_error`` string. That
 * works for smoke ("does the user message persist?") but
 * blocks every spec that needs deterministic AI behaviour
 * (auto-loop, step-evaluation, conversation analysis, etc.).
 *
 * Strategy: intercept the browser-to-backend calls at the
 * Playwright route layer (matches Bibliogon's pattern in
 * ``e2e/smoke/ai-review.spec.ts``). The backend never sees
 * the real call — Playwright fulfils the response shape the
 * frontend's ``SessionMessageExchangeResult`` /
 * ``ConversationAnalysisOut`` / etc. consumers expect.
 *
 * Mocks are registered per-test via the helpers below. Each
 * helper returns a ``Promise<void>`` that resolves once the
 * route is registered; the caller continues with the rest
 * of the spec.
 */

import type {Page, Route} from "@playwright/test";

/** Options for ``mockSessionMessage``. Sensible defaults
 *  cover the "single happy assistant reply" case. */
export interface MockMessageOptions {
    /** Assistant reply body. Defaults to a deterministic
     *  one-liner. */
    assistantText?: string;
    /** When set, the response carries a non-null
     *  ``step_evaluation`` block. ``advance=true`` advances
     *  the session's cycle_step (the frontend asserts on
     *  ``session.cycle_step``). */
    stepEvaluation?: {
        confidence: number;
        from_step: number;
        to_step: number;
        reason: string;
        applied: boolean;
        fallback_used: boolean;
    };
    /** When set, the response carries a non-null
     *  ``topic_transition`` block (Phase 17 auto-loop).
     *  ``looped=true`` flips ``new_cycle_count`` to the
     *  next value. */
    topicTransition?: {
        topic: string;
        summary: string;
        next_topic: string | null;
        next_topic_rationale: string;
        difficulty_adjustment: string;
        continue_recommended: boolean;
        fallback_used: boolean;
        looped: boolean;
        new_cycle_count: number;
    };
    /** Override the cycle_step on the returned ``session``
     *  object. Defaults to 1; pass 7 to simulate landing on
     *  the cycle's last step. */
    sessionCycleStep?: number;
    /** Override the cycle_count on the returned ``session``.
     *  Defaults to 1. */
    sessionCycleCount?: number;
    /** When set, surfaced as the response's ``ai_error``
     *  field; ``assistant_message`` is then ``null``. */
    aiError?: string;
}

/** Register a route handler for ``POST .../message``. Returns
 *  the registered handler's session-id matcher for chaining.
 *  Idempotent: re-registering replaces the prior handler. */
export async function mockSessionMessage(
    page: Page,
    opts: MockMessageOptions = {},
): Promise<void> {
    await page.route(
        "**/api/plugins/session/*/message",
        async (route: Route) => {
            const method = route.request().method();
            if (method !== "POST") {
                await route.continue();
                return;
            }
            const url = new URL(route.request().url());
            const sessionId = extractSessionId(url.pathname);
            const userBody = parseRequestBody(route);
            const now = nowIso();
            const assistantText =
                opts.assistantText ??
                "Mock AI reply (deterministic for E2E).";
            const stepEvaluation = opts.stepEvaluation
                ? {
                      ...opts.stepEvaluation,
                      evaluated_at: now,
                  }
                : null;
            const topicTransition = opts.topicTransition ?? null;
            const cycleStep = opts.sessionCycleStep ?? 1;
            const cycleCount = opts.sessionCycleCount ?? 1;
            const payload = {
                user_message: {
                    id: `mock-user-${sessionId}-${Date.now()}`,
                    session_id: sessionId,
                    role: "user",
                    content: (userBody.content as string) ?? "",
                    created_at: now,
                },
                assistant_message: opts.aiError
                    ? null
                    : {
                          id: `mock-ai-${sessionId}-${Date.now()}`,
                          session_id: sessionId,
                          role: "assistant",
                          content: assistantText,
                          created_at: now,
                      },
                ai_error: opts.aiError ?? null,
                session: {
                    id: sessionId,
                    project_id: `mock-project-${sessionId}`,
                    method: "deductive",
                    started_at: now,
                    ended_at: null,
                    cycle_step: cycleStep,
                    status: "active",
                    cycle_count: cycleCount,
                    cycle_topics: [],
                },
                step_evaluation: stepEvaluation,
                topic_transition: topicTransition,
                timings: null,
                model_warning: null,
            };
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(payload),
            });
        },
    );
}

/** Mock the streaming SSE endpoint. Emits three events
 *  (``start`` / one ``chunk`` / ``done``) so the frontend
 *  can pin the progressive-rendering contract without
 *  brittle chunked-body assertions.
 *
 *  ``opts.chunks`` can be expanded to N events; the default
 *  is one. */
export interface MockStreamOptions {
    assistantText?: string;
    chunks?: string[];
}

export async function mockSessionMessageStream(
    page: Page,
    opts: MockStreamOptions = {},
): Promise<void> {
    const fullText =
        opts.assistantText ??
        "Streamed mock reply for E2E.";
    const chunks = opts.chunks ?? [fullText];
    await page.route(
        "**/api/plugins/session/*/message/stream",
        async (route: Route) => {
            const url = new URL(route.request().url());
            const sessionId = extractStreamSessionId(url.pathname);
            const userBody = parseRequestBody(route);
            const now = nowIso();
            const lines: string[] = [];
            // SSE event 1: start (user message persisted).
            lines.push("event: start");
            lines.push(
                "data: " +
                    JSON.stringify({
                        user_message: {
                            id: `mock-user-${sessionId}-${Date.now()}`,
                            session_id: sessionId,
                            role: "user",
                            content: (userBody.content as string) ?? "",
                            created_at: now,
                        },
                    }),
            );
            lines.push("");
            // SSE events 2..N: chunk(s).
            for (const chunk of chunks) {
                lines.push("event: chunk");
                lines.push("data: " + JSON.stringify({delta: chunk}));
                lines.push("");
            }
            // SSE event last: done — same composite shape as
            // the non-streaming /message endpoint.
            lines.push("event: done");
            lines.push(
                "data: " +
                    JSON.stringify({
                        user_message: {
                            id: `mock-user-${sessionId}-${Date.now()}`,
                            session_id: sessionId,
                            role: "user",
                            content: (userBody.content as string) ?? "",
                            created_at: now,
                        },
                        assistant_message: {
                            id: `mock-ai-${sessionId}-${Date.now()}`,
                            session_id: sessionId,
                            role: "assistant",
                            content: fullText,
                            created_at: now,
                        },
                        ai_error: null,
                        session: {
                            id: sessionId,
                            project_id: `mock-project-${sessionId}`,
                            method: "deductive",
                            started_at: now,
                            ended_at: null,
                            cycle_step: 1,
                            status: "active",
                            cycle_count: 1,
                            cycle_topics: [],
                        },
                        step_evaluation: null,
                        topic_transition: null,
                        timings: null,
                        model_warning: null,
                    }),
            );
            lines.push("");
            await route.fulfill({
                status: 200,
                headers: {
                    "content-type": "text/event-stream",
                    "cache-control": "no-cache",
                },
                body: lines.join("\n"),
            });
        },
    );
}

/** Mock the conversation-analysis route used by the
 *  /import flow. Returns a deterministic ``ConversationAnalysisOut``
 *  shape. */
export interface MockConversationAnalysisOptions {
    topic?: string;
    level?: string;
    strengths?: string[];
    gaps?: string[];
    suggestedMethod?: string;
    suggestedLessons?: Array<{title: string; rationale: string}>;
}

export async function mockConversationAnalysis(
    page: Page,
    opts: MockConversationAnalysisOptions = {},
): Promise<void> {
    await page.route("**/api/imports/analyze", async (route: Route) => {
        const userBody = parseRequestBody(route);
        const payload = {
            id: "mock-analysis-id",
            conversation_id: (userBody.conversation_id as string) ?? "mock-conv",
            topic: opts.topic ?? "Spanish B1 fluency",
            level: opts.level ?? "B1",
            strengths: opts.strengths ?? [
                "Comfortable with present tense.",
                "Good vocabulary for daily routines.",
            ],
            gaps: opts.gaps ?? [
                "Subjunctive mood needs work.",
                "Limited business vocabulary.",
            ],
            recommended_method: opts.suggestedMethod ?? "dialogic",
            suggested_lessons: opts.suggestedLessons ?? [
                {
                    title: "Subjunctive practice",
                    rationale:
                        "Identified gap; needs targeted exercises.",
                },
                {
                    title: "Business Spanish",
                    rationale: "Expand vocabulary in professional contexts.",
                },
            ],
            created_at: nowIso(),
        };
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(payload),
        });
    });
}

/** Mock GET /api/settings/{user_id}/available-models. */
export interface MockAvailableModelsOptions {
    provider?: "anthropic" | "openai" | "gemini";
    models?: Array<{
        id: string;
        name: string;
        context_window: number;
        recommended: boolean;
    }>;
}

export async function mockAvailableModels(
    page: Page,
    opts: MockAvailableModelsOptions = {},
): Promise<void> {
    await page.route(
        "**/api/settings/*/available-models*",
        async (route: Route) => {
            const provider = opts.provider ?? "anthropic";
            const models = opts.models ?? [
                {
                    id: "claude-opus-4-7",
                    name: "Claude Opus 4.7",
                    context_window: 200_000,
                    recommended: true,
                },
                {
                    id: "claude-sonnet-4-6",
                    name: "Claude Sonnet 4.6",
                    context_window: 200_000,
                    recommended: true,
                },
                {
                    id: "claude-haiku-4-5",
                    name: "Claude Haiku 4.5",
                    context_window: 200_000,
                    recommended: false,
                },
            ];
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({provider, models, cached: false}),
            });
        },
    );
}

// --- Helpers -------------------------------------------------------------

function nowIso(): string {
    return new Date().toISOString();
}

function extractSessionId(pathname: string): string {
    // /api/plugins/session/{session_id}/message -> {session_id}
    const parts = pathname.split("/");
    const idx = parts.indexOf("session");
    return parts[idx + 1] ?? "mock-session";
}

function extractStreamSessionId(pathname: string): string {
    // /api/plugins/session/{session_id}/message/stream -> {session_id}
    const parts = pathname.split("/");
    const idx = parts.indexOf("session");
    return parts[idx + 1] ?? "mock-session";
}

function parseRequestBody(route: Route): Record<string, unknown> {
    try {
        const raw = route.request().postData();
        if (!raw) return {};
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return {};
    }
}
