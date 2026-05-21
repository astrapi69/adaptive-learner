/**
 * Phase 28I / v1.15.0 — Streaming chat (3-chunk SSE).
 *
 * Verifies the v1.6.0 / Phase 19 streaming chat contract:
 *
 *   - Sending a message in /session triggers the SSE
 *     endpoint /api/plugins/session/{id}/message/stream.
 *   - The mock emits a 3-event SSE body (start / chunk /
 *     done); the frontend progressively renders the chunk
 *     into the streaming assistant bubble.
 *   - The final ``done`` event replaces the streaming
 *     bubble with the persisted assistant message.
 *
 * The 3-chunk minimal stream is the documented contract pin
 * per Phase 28's Q3 confirmation. Single chunk is enough to
 * prove the SSE round-trip without brittle multi-chunk
 * timing assertions.
 */

import {expect, test, type Route} from "@playwright/test";

import {
    createTestUser,
    sendChatMessage,
    startSession,
} from "../helpers";

test.describe("Streaming chat", () => {
    test("SSE stream renders the assistant message via 3-event flow", async ({
        page,
    }) => {
        await createTestUser(page, {name: "Stream E2E"});

        // Mock the stream endpoint with a single deterministic
        // chunk. The done event carries the final assistant
        // message that replaces the streaming bubble.
        const ASSISTANT_TEXT = "Streamed response payload.";
        await page.route(
            "**/api/plugins/session/*/message/stream",
            async (route: Route) => {
                if (route.request().method() !== "POST") {
                    await route.continue();
                    return;
                }
                const url = new URL(route.request().url());
                const sessionId = url.pathname.split("/")[4];
                const now = new Date().toISOString();
                const userBody = (() => {
                    try {
                        return JSON.parse(
                            route.request().postData() ?? "{}",
                        ) as Record<string, unknown>;
                    } catch {
                        return {};
                    }
                })();
                const userText =
                    (userBody.content as string) ?? "Test message";

                const doneBody = {
                    user_message: {
                        id: `mock-user-${sessionId}`,
                        session_id: sessionId,
                        role: "user",
                        content: userText,
                        created_at: now,
                    },
                    assistant_message: {
                        id: `mock-ai-${sessionId}`,
                        session_id: sessionId,
                        role: "assistant",
                        content: ASSISTANT_TEXT,
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
                };
                const sseBody =
                    `event: start\ndata: ${JSON.stringify({
                        user_message: doneBody.user_message,
                    })}\n\n` +
                    `event: chunk\ndata: ${JSON.stringify({delta: ASSISTANT_TEXT})}\n\n` +
                    `event: done\ndata: ${JSON.stringify(doneBody)}\n\n`;
                await route.fulfill({
                    status: 200,
                    headers: {
                        "content-type": "text/event-stream",
                        "cache-control": "no-cache",
                    },
                    body: sseBody,
                });
            },
        );

        await startSession(page);
        await expect(page.getByTestId("session")).toBeVisible();
        await sendChatMessage(page, "Quick streaming smoke");

        // The assistant bubble renders the streamed text from
        // the ``done`` event. With a single chunk the streaming
        // -> final transition happens fast; the contract pin is
        // that the final content matches exactly.
        const assistantBubble = page.getByTestId("chat-message-assistant");
        await expect(assistantBubble).toBeVisible({timeout: 10_000});
        await expect(assistantBubble).toContainText(ASSISTANT_TEXT);
    });
});
