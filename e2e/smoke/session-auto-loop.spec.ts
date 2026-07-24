/**
 * Phase 28B / v1.15.0 — Multi-cycle session auto-loop.
 *
 * Verifies the v1.4.0 auto-loop contract (see Phase 17):
 *
 *   - The 7-step cycle progress UI advances as the
 *     step-evaluation hook returns advance verdicts.
 *   - At step 7 with a topic_transition response carrying
 *     ``looped: true`` / ``new_cycle_count: 2``, the session
 *     resets to step 1 of cycle 2.
 *   - The assistant-ui thread renders the cycle transition inline between
 *     the two cycles (the summary + next topic as an assistant turn, #1126).
 *   - The session header badge surfaces ``Cycle 2``.
 *   - End → RatingDialog summarises the multi-cycle journey
 *     (the ``rating-cycles-summary`` block appears when
 *     ``cycle_count > 1``).
 *
 * The frontend uses POST ``/api/plugins/session/{id}/message/stream``
 * (v1.6.0 / Phase 19) for chat, NOT the non-streaming
 * ``/message`` route, so the stateful mock below intercepts
 * the SSE endpoint and emits a 3-chunk stream (start / chunk /
 * done) per turn. The composite payload — assistant_message,
 * session.cycle_step, step_evaluation, topic_transition — lives
 * inside the ``done`` event so the frontend's
 * ``handlers.onDone`` receives the same shape as the
 * non-streaming route returns.
 */

import {expect, test, type Route} from "@playwright/test";

import {
    createTestUser,
    sendChatMessage,
    startSession,
} from "../helpers";

test.describe("Session auto-loop (multi-cycle)", () => {
    test("advances through steps 1-7, transitions to cycle 2, ends with multi-cycle summary", async ({
        page,
    }) => {
        await createTestUser(page, {name: "Auto-Loop E2E"});

        // Stateful SSE mock for the /message/stream endpoint.
        // Each consecutive POST returns the next step's payload.
        // Call 1: step 1 -> 2. Call 6: step 6 -> 7. Call 7:
        // topic_transition with looped=true, new_cycle_count=2.
        let callCount = 0;
        await page.route(
            "**/api/plugins/session/*/message/stream",
            async (route: Route) => {
                if (route.request().method() !== "POST") {
                    await route.continue();
                    return;
                }
                callCount += 1;
                const url = new URL(route.request().url());
                const sessionId = url.pathname.split("/")[4];
                const now = new Date().toISOString();
                const fromStep = Math.min(callCount, 7);
                const toStep = Math.min(fromStep + 1, 7);
                const looped = callCount >= 7;
                const cycleStep = looped ? 1 : toStep;
                const cycleCount = looped ? 2 : 1;
                const userBody = parseBody(route);
                const userText =
                    (userBody.content as string) ?? `Mock turn ${callCount}`;
                const assistantText = `Mock AI reply ${callCount}.`;

                const topicTransition = looped
                    ? {
                          topic: "Basic conversation",
                          summary:
                              "First cycle complete; subject mostly grasped.",
                          next_topic: "Past tense — preterite",
                          next_topic_rationale:
                              "Natural next subtopic for the learner.",
                          difficulty_adjustment: "same",
                          continue_recommended: true,
                          fallback_used: false,
                          looped: true,
                          new_cycle_count: 2,
                      }
                    : null;

                const doneBody = {
                    user_message: {
                        id: `mock-user-${callCount}`,
                        session_id: sessionId,
                        role: "user",
                        content: userText,
                        created_at: now,
                    },
                    assistant_message: {
                        id: `mock-ai-${callCount}`,
                        session_id: sessionId,
                        role: "assistant",
                        content: assistantText,
                        created_at: now,
                    },
                    ai_error: null,
                    session: {
                        id: sessionId,
                        project_id: `mock-project-${sessionId}`,
                        method: "deductive",
                        started_at: now,
                        ended_at: null,
                        cycle_step: cycleStep,
                        status: "active",
                        cycle_count: cycleCount,
                        cycle_topics: looped
                            ? [
                                  {
                                      cycle: 1,
                                      topic: "Basic conversation",
                                      summary:
                                          "First cycle complete; subject mostly grasped.",
                                      next_topic: "Past tense — preterite",
                                  },
                              ]
                            : [],
                    },
                    step_evaluation: {
                        confidence: 0.85,
                        from_step: fromStep,
                        to_step: toStep,
                        reason: `Advance from step ${fromStep} (mock E2E).`,
                        applied: true,
                        fallback_used: false,
                        evaluated_at: now,
                    },
                    topic_transition: topicTransition,
                    timings: null,
                    model_warning: null,
                };

                // Compose the 3-event SSE body. Each frame MUST
                // end with ``\n\n`` so the frontend's SSE reader
                // emits it from the inner split loop (otherwise
                // the final frame stays in the buffer until the
                // connection closes — and Playwright's
                // route.fulfill behaviour around SSE-flavoured
                // bodies isn't reliable for triggering EOF
                // cleanly. Bibliogon's ai-review.spec.ts proved
                // the trailing-``\n\n`` pattern works).
                const sseBody =
                    `event: start\ndata: ${JSON.stringify({
                        user_message: doneBody.user_message,
                    })}\n\n` +
                    `event: chunk\ndata: ${JSON.stringify({delta: assistantText})}\n\n` +
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
        await expect(page.getByTestId("cycle-progress")).toBeVisible();

        // Step 1 -> 2 -> ... -> 7 -> transition. Seven turns. Wait for each
        // turn's reply TEXT (robust to the extra assistant bubble the auto-loop
        // appends after turn 7 — the inline cycle-transition, #1126).
        for (let i = 1; i <= 7; i += 1) {
            await sendChatMessage(page, `Message ${i}`);
            await expect(
                page.getByText(`Mock AI reply ${i}.`),
            ).toBeVisible({timeout: 10_000});
        }

        // After the 7th message the auto-loop appends the cycle transition as an
        // inline assistant turn (#1126): the cycle summary + next topic land in
        // the visible conversation, and the header badge surfaces Cycle 2.
        await expect(
            page.getByText("First cycle complete; subject mostly grasped."),
        ).toBeVisible();
        await expect(page.getByText("Past tense — preterite")).toBeVisible();
        await expect(page.getByTestId("session-cycle-counter")).toBeVisible();
        await expect(
            page.getByTestId("session-cycle-counter"),
        ).toContainText("2");

        // Cycle 2 step 1 — caption reflects the reset.
        await expect(page.getByTestId("cycle-caption")).toContainText("1");

        // End → multi-cycle summary in the rating dialog.
        await page.getByTestId("session-end").click();
        await expect(page.getByTestId("rating-dialog")).toBeVisible();
        await expect(
            page.getByTestId("rating-cycles-summary"),
        ).toBeVisible();
        await expect(
            page.getByTestId("rating-cycles-summary"),
        ).toContainText("2");

        // Submit defaults; return to dashboard.
        await page.getByTestId("rating-submit").click();
        await page.waitForURL("**/dashboard");
    });
});

function parseBody(route: Route): Record<string, unknown> {
    try {
        const raw = route.request().postData();
        if (!raw) return {};
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return {};
    }
}
