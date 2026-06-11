/**
 * Anki card extraction + export workflow (Dexie mode). Closes #279.
 *
 * GH-Pages-shape build, NO backend. Covers the parts of the Anki flow that
 * run without a provider key:
 *
 *  - ``/anki`` empty state + the no-key notice (Settings > Integrations CTA).
 *  - ``/import/:id`` (analyzed) gates "Extract Anki cards" behind a key.
 *  - Seeded cards render with front, back and tags.
 *  - Export is disabled until a card is accepted, then downloads a non-empty
 *    ``.apkg`` (SQLite-in-ZIP, the app's only export format — not CSV/JSON).
 *
 * The AI extraction itself needs a real key (``seedTestApiKey`` is API-mode
 * only), so "extract -> cards appear" and the Anki Desktop import are manual
 * checks. Cards are seeded directly into IndexedDB to exercise the export
 * path deterministically.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";

/** Read the active learner's user id from localStorage. */
async function activeUserId(page: Page): Promise<string> {
  const id = await page.evaluate(() =>
    localStorage.getItem("adaptive-learner.user_id"),
  );
  if (!id) throw new Error("no user_id after createTestUser");
  return id;
}

/**
 * Write rows into the live ``adaptive-learner`` IndexedDB. The app has
 * already opened (and upgraded) the DB by the time this runs, so opening
 * without a version attaches to the current schema. Object stores use
 * inline ``id`` keys, so ``put`` accepts the row verbatim.
 */
async function seedRows(
  page: Page,
  store: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  await page.evaluate(
    ({ storeName, items }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("adaptive-learner");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(storeName, "readwrite");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
          const os = tx.objectStore(storeName);
          for (const item of items) os.put(item);
        };
      }),
    { storeName: store, items: rows },
  );
}

function ankiCardRow(
  userId: string,
  id: string,
  front: string,
  back: string,
  tags: string[],
): Record<string, unknown> {
  const ts = "2026-06-11T10:00:00.000Z";
  return {
    id,
    user_id: userId,
    session_id: null,
    conversation_id: null,
    project_id: null,
    card_type: "basic",
    front,
    back,
    tags: JSON.stringify(tags),
    accepted: false,
    rejected: false,
    exported_at: null,
    created_at: ts,
    updated_at: ts,
  };
}

test.describe("Anki — extraction gating + export workflow", () => {
  test("empty /anki shows the empty state + no-key notice", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await createTestUser(page);

    await page.goto("/anki");
    await expect(page.getByTestId("anki-page")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("anki-empty")).toBeVisible();
    // No key configured in Dexie mode -> the empty state points to Settings.
    await expect(page.getByTestId("api-key-required-notice")).toBeVisible();
    // Nothing to export yet.
    await expect(page.getByTestId("anki-export-button")).toBeDisabled();

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("import detail gates 'Extract Anki cards' behind an API key", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await createTestUser(page);
    const userId = await activeUserId(page);

    const convId = "conv-anki-e2e";
    await seedRows(page, "importedConversations", [
      {
        id: convId,
        user_id: userId,
        project_id: null,
        source: "chatgpt",
        title: "Anki E2E conversation",
        message_count: 2,
        imported_at: "2026-06-11T09:00:00.000Z",
        analyzed: true,
        analysis_result: {
          topic: "Greetings",
          summary: "A short chat about greetings.",
          subtopics: [],
          strengths: [],
          weaknesses: [],
          vocabulary: [],
        },
        topic_tag: null,
        model: null,
        source_created_at: null,
        content_hash: null,
        source_language: "de",
        target_language: "fr",
      },
    ]);
    await seedRows(page, "importedMessages", [
      {
        id: "msg-1",
        conversation_id: convId,
        role: "user",
        content: "How do I say hello in French?",
        timestamp: null,
        order_index: 0,
        created_at: "2026-06-11T09:00:00.000Z",
      },
      {
        id: "msg-2",
        conversation_id: convId,
        role: "assistant",
        content: "Bonjour.",
        timestamp: null,
        order_index: 1,
        created_at: "2026-06-11T09:00:01.000Z",
      },
    ]);

    await page.goto(`/import/${convId}`);
    const extract = page.getByTestId("extract-anki-button");
    await expect(extract).toBeVisible({ timeout: 15000 });
    await expect(extract).toBeDisabled();
    await expect(page.getByTestId("api-key-required-notice")).toBeVisible();

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("seeded cards render and export to a non-empty .apkg", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await createTestUser(page);
    const userId = await activeUserId(page);

    await seedRows(page, "ankiCards", [
      ankiCardRow(userId, "card-1", "Bonjour", "Hallo", ["greeting", "fr"]),
      ankiCardRow(userId, "card-2", "Merci", "Danke", ["politeness"]),
    ]);

    await page.goto("/anki");
    await expect(page.getByTestId("anki-page")).toBeVisible({ timeout: 15000 });

    // Both seeded cards render with front, back and tags.
    const card1 = page.getByTestId("anki-card-card-1");
    await expect(card1).toBeVisible();
    await expect(card1).toContainText("Bonjour");
    await expect(card1).toContainText("Hallo");
    await expect(card1).toContainText("greeting");
    await expect(page.getByTestId("anki-card-card-2")).toBeVisible();

    // Export is gated until at least one card is accepted.
    await expect(page.getByTestId("anki-export-button")).toBeDisabled();
    await page.getByTestId("anki-toggle-card-1").click();
    await expect(page.getByTestId("anki-export-button")).toBeEnabled();

    // Export downloads a non-empty .apkg.
    const fs = await import("node:fs/promises");
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("anki-export-button").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.apkg$/);
    const path = await download.path();
    const bytes = await fs.readFile(path);
    expect(bytes.byteLength).toBeGreaterThan(0);

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
