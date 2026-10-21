/**
 * An imported-chat session sends its AI opening once (#3806). Dexie build,
 * NO backend.
 *
 * Measured before the fix: starting a session from an imported chat sent a
 * streamed POST /v1/messages, whose system prompt holds the whole imported
 * transcript, plus a step-evaluator POST, with nothing typed; every reload of
 * /session?session=<id> and every second tab on it sent both again.
 *
 * The provider is mocked with a context route (so a second tab is covered
 * too) and every POST to it is recorded. The first open must send exactly the
 * two opening requests; a reload, a re-open through "Continue session" on the
 * imported chat, and a second tab must resume the stored conversation and
 * send none.
 */

import { expect, test, type BrowserContext, type Route } from "@playwright/test";

import { saveAnthropicKey } from "../helpers/ai-key";
import { createTestUser } from "../helpers/onboarding";

const OPENING_QUESTION = "Erste Frage: Was braucht eine Pflanze zum Leben?";

const ANALYSIS_JSON = JSON.stringify({
  topic: "Photosynthese",
  user_level: "beginner",
  summary: "Licht, Wasser und Chlorophyll.",
  strengths: ["Grundbegriffe"],
  weaknesses: ["Chlorophyll"],
  error_patterns: [],
  recommended_method: "deductive",
  recommended_focus: "Die Rolle des Chlorophylls",
  vocabulary: [],
  suggested_curriculum: [],
});

const VERDICT_JSON = JSON.stringify({
  advance: false,
  confidence: 0.4,
  reason: "e2e",
  suggested_step: 1,
});

const IMPORTED_CHAT =
  "Ich: Wie funktioniert Photosynthese?\n\n" +
  "Assistent: Pflanzen wandeln Licht in chemische Energie um.\n\n" +
  "Ich: Und was ist Chlorophyll?\n\n" +
  "Assistent: Der grüne Farbstoff, der das Licht aufnimmt.";

/** How long a resumed page stays quiet before "no request" is asserted. The
 *  thread decides on the opening in the same callback that shows the stored
 *  turns, and a sent opening reaches the route within milliseconds of that,
 *  so the window is generous. ``waitForLoadState("networkidle")`` is no such
 *  window: it returns at once when the page went idle earlier in its load. */
const QUIET_WINDOW_MS = 1500;

/** One POST the app sent to the provider. */
interface ProviderPost {
  stream: boolean;
  evaluator: boolean;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

/** Answer every provider request locally and record each POST: the streamed
 *  chat call gets the opening question, the step evaluator a verdict, the
 *  import analysis the canned analysis, the key test a model list. */
async function mockProvider(context: BrowserContext, posts: ProviderPost[]): Promise<void> {
  await context.route("**/api.anthropic.com/**", async (route: Route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    if (request.method() !== "POST") {
      await route.fulfill({
        status: 200,
        headers: CORS,
        contentType: "application/json",
        body: JSON.stringify({ data: [{ id: "claude-haiku-4-5-20251001", display_name: "e2e" }] }),
      });
      return;
    }
    const body = request.postDataJSON() as { stream?: boolean; system?: string };
    const stream = body.stream === true;
    const evaluator = String(body.system ?? "").includes("assessment co-pilot");
    posts.push({ stream, evaluator });
    if (stream) {
      const frame = (data: Record<string, unknown>) =>
        `event: ${String(data.type)}\ndata: ${JSON.stringify(data)}\n\n`;
      await route.fulfill({
        status: 200,
        headers: CORS,
        contentType: "text/event-stream",
        body:
          frame({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: OPENING_QUESTION } }) +
          frame({ type: "message_stop" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: CORS,
      contentType: "application/json",
      body: JSON.stringify({ content: [{ type: "text", text: evaluator ? VERDICT_JSON : ANALYSIS_JSON }] }),
    });
  });
}

test.describe("Imported-chat session opens once (#3806)", () => {
  test("a reload, a re-open and a second tab resume the stored conversation without a provider request", async ({
    page,
    context,
  }) => {
    const posts: ProviderPost[] = [];
    await mockProvider(context, posts);
    await createTestUser(page);
    await saveAnthropicKey(page);

    await page.goto("/content?tab=import");
    await page.getByTestId("quick-paste-textarea").fill(IMPORTED_CHAT);
    await page.getByTestId("quick-analyze-button").click();
    await expect(page.getByTestId("conversation-transcript")).toBeVisible({ timeout: 20000 });
    const importUrl = page.url();

    // From here on, count only what the session sends.
    posts.length = 0;
    await page.getByTestId("start-session-button").click();
    await page.waitForURL(/\/session\?session=/);
    const assistant = page.getByTestId("chat-message-assistant");
    await expect(assistant).toContainText(OPENING_QUESTION, { timeout: 15000 });
    // The first open sends the opening: one streamed chat request, one step evaluation.
    await expect.poll(() => posts.length).toBe(2);
    expect(posts).toEqual([
      { stream: true, evaluator: false },
      { stream: false, evaluator: true },
    ]);

    // A reload resumes the stored conversation; nothing goes to the provider.
    await page.reload();
    await expect(assistant).toHaveCount(1, { timeout: 15000 });
    await expect(assistant).toContainText(OPENING_QUESTION);
    await expect(page.getByTestId("chat-message-user")).toHaveCount(0);
    await page.waitForTimeout(QUIET_WINDOW_MS);
    expect(posts).toHaveLength(2);

    // Re-open: "Continue session" on the imported chat leads back to the same
    // session, which resumes the same way.
    const sessionUrl = page.url();
    await page.goto(importUrl);
    await page.getByTestId("continue-session-button").click();
    await page.waitForURL(sessionUrl);
    await expect(assistant).toHaveCount(1, { timeout: 15000 });
    await expect(assistant).toContainText(OPENING_QUESTION);
    await page.waitForTimeout(QUIET_WINDOW_MS);
    expect(posts).toHaveLength(2);

    // A second tab on the same session finds the same record.
    const secondTab = await context.newPage();
    await secondTab.goto(sessionUrl);
    await expect(secondTab.getByTestId("chat-message-assistant")).toContainText(OPENING_QUESTION, {
      timeout: 15000,
    });
    await secondTab.waitForTimeout(QUIET_WINDOW_MS);
    expect(posts).toHaveLength(2);
  });
});
