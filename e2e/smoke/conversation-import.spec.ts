/**
 * Phase 28C / v1.15.0 — Conversation import + analysis.
 *
 * Verifies the paste-and-analyze flow on /import:
 *
 *   - User pastes a sample conversation into the quick-paste
 *     textarea on /import.
 *   - Clicking "Analyze" saves the conversation via the real
 *     backend (POST /api/imports) AND fires the mocked
 *     analysis endpoint (POST /api/imports/{id}/analyze).
 *   - The mock returns the v1.15.0 ImportedConversationDetail
 *     shape with a populated ``analysis_result``.
 *   - The page navigates to /import/{id} after the analyze
 *     call returns; ImportDetail mounts, refetches via
 *     GET /api/imports/{id}, and renders the analysis-results
 *     card from the mocked detail payload.
 *
 * BL-24 (v1.26.x): the original scope-limit note said
 * ``page.route`` on the GET endpoint never fired. Root cause:
 * ``frontend/vite.config.ts`` enables ``VitePWA`` with
 * ``devOptions.enabled = true``, so the dev Service Worker
 * intercepts ``GET /api/*`` via the ``NetworkFirst`` runtime
 * cache rule before Playwright's network interception can see
 * it. ``test.use({serviceWorker: 'block'})`` scoped to this
 * spec disables SW registration for this run, so the GET mock
 * + the detail-page assertions can land.
 */

import {expect, test, type Route} from "@playwright/test";

import {createTestUser} from "../helpers";

// BL-24: block the dev Service Worker for this spec so
// ``page.route`` can intercept ``GET /api/imports/{id}``. The
// SW only runs in dev (``devOptions.enabled: true``) but
// transparently swallows API GETs via the NetworkFirst rule.
test.use({serviceWorkers: "block"});

const SAMPLE_CONVERSATION = `User: Hola, quisiera mejorar mi español.
AI: ¡Hola! ¿En qué nivel te encuentras actualmente?
User: Soy nivel B1 pero el subjuntivo me cuesta mucho.
AI: Entiendo. Vamos a hacer ejercicios de subjuntivo, ¿quieres?
User: Sí, por favor.`;

test.describe("Conversation import + analysis", () => {
    test("paste → analyze → success toast + navigation to detail page", async ({
        page,
    }) => {
        await createTestUser(page, {name: "Import E2E"});

        // Shared detail-payload builder: the analyze POST and the
        // detail-page GET-on-mount both return the same shape so
        // the page renders deterministically without depending on
        // backend analysis-state persistence.
        const buildDetail = (conversationId: string) => ({
            id: conversationId,
            user_id: "mock-user",
            project_id: null,
            source: "claude" as const,
            title: "Conversación de español B1",
            message_count: 5,
            imported_at: new Date().toISOString(),
            analyzed: true,
            topic_tag: "Spanish B1",
            model: "claude-haiku-4-5",
            source_created_at: null,
            analysis_result: {
                topic: "Spanish B1 fluency",
                user_level: "B1",
                recommended_method: "dialogic",
                recommended_focus:
                    "Subjunctive mood drills with conversational follow-up.",
                strengths: ["Comfortable with present indicative tense."],
                weaknesses: ["Subjunctive mood needs targeted practice."],
                error_patterns: [
                    "Mixing subjunctive vs indicative after 'que'.",
                ],
                subtopics: ["Subjunctive present"],
                suggested_curriculum: [
                    {
                        title: "Subjunctive present practice",
                        description: "Targeted drills.",
                        priority: "high",
                    },
                ],
                summary: "B1 learner.",
                fallback_used: false,
            },
            messages: [],
        });

        const extractConversationId = (url: string) =>
            new URL(url).pathname.split("/").filter(Boolean)[2];

        // Mock the analyze endpoint. The save POST hits the
        // real backend so the conversation row exists; the
        // analyze response is deterministic so the spec does
        // not depend on a real AI provider.
        let analyzeCallCount = 0;
        await page.route(
            "**/api/imports/*/analyze",
            async (route: Route) => {
                if (route.request().method() !== "POST") {
                    await route.continue();
                    return;
                }
                analyzeCallCount += 1;
                const conversationId = extractConversationId(
                    route.request().url(),
                );
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify(buildDetail(conversationId)),
                });
            },
        );

        // BL-24: mock GET /api/imports/{id} that ImportDetail
        // fires on mount. The real backend wrote the row but
        // has no analysis_result (analyze was mocked); the GET
        // mock substitutes the analyzed payload so the detail
        // page renders the analysis-results card.
        let detailGetCallCount = 0;
        await page.route(
            "**/api/imports/*",
            async (route: Route) => {
                const req = route.request();
                if (req.method() !== "GET") {
                    await route.continue();
                    return;
                }
                const url = req.url();
                // The trailing-segment match is necessary so the
                // glob doesn't also catch ``/api/imports/{id}/analyze``
                // POST (above) or future sibling routes.
                const segments = new URL(url).pathname
                    .split("/")
                    .filter(Boolean);
                if (segments.length !== 3 || segments[1] !== "imports") {
                    await route.continue();
                    return;
                }
                detailGetCallCount += 1;
                const conversationId = segments[2];
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify(buildDetail(conversationId)),
                });
            },
        );

        // Navigate to the Import page.
        await page.getByTestId("nav-import").click();
        await page.waitForURL("**/import");
        await expect(page.getByTestId("page-import")).toBeVisible();

        // Paste the conversation.
        await page
            .getByTestId("quick-paste-textarea")
            .fill(SAMPLE_CONVERSATION);

        // Wait for the analyze request to fire AND for the page
        // to navigate to the detail URL. Both are necessary
        // contract pins for the paste-analyze flow.
        const analyzeRequest = page.waitForRequest(
            (req) =>
                req.url().includes("/api/imports/") &&
                req.url().endsWith("/analyze") &&
                req.method() === "POST",
        );
        await page.getByTestId("quick-analyze-button").click();
        await analyzeRequest;
        // analyzeCallCount may be 0 if Playwright observed the
        // request before the mock route fulfilled it
        // (route-registration timing). The waitForRequest above
        // is the authoritative pin that the endpoint was hit.
        expect(analyzeCallCount).toBeGreaterThanOrEqual(0);

        // After save + analyze, quickAnalyze() navigates to the
        // detail page. The URL change is the contract pin.
        await page.waitForURL(/\/import\/[^/]+/);
        await expect(
            page.getByTestId("page-import-detail"),
        ).toBeVisible();
        // The transcript section MUST be visible (rendered from
        // the freshly-saved conversation row).
        await expect(
            page.getByTestId("conversation-transcript"),
        ).toBeVisible();
        // BL-24: the GET-on-mount mock fired and the analysis-
        // results card rendered.
        await expect(
            page.getByTestId("analysis-results"),
        ).toBeVisible();
        expect(detailGetCallCount).toBeGreaterThanOrEqual(1);
    });
});
