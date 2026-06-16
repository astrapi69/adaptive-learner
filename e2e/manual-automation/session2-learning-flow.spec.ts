/**
 * Session 2 — Learning flow (manual test plan automation, #616).
 *
 * Dexie build, no backend, bundled ``fr-a1-from-en`` set. Covers the core
 * lesson journey: theory markdown render, exercise interaction (matching
 * A→B + B→A #509, free-text feedback), uniform tile height, the Enter
 * shortcut, read-only revisit, the result export, and the XP surfaces.
 *
 * Conditional checks (skip with a reason when the precondition isn't met
 * in the headless build): the theory example link (#139 — only when a
 * theory step carries an example_url) and read-aloud (needs a TTS voice,
 * which headless chromium lacks → ``lesson-tts-novoice``).
 */

import { expect, test } from "@playwright/test";

import { installErrorCollectors } from "./helpers/collectors";
import { ContentPage } from "./pages/ContentPage";
import { LessonRunner } from "./pages/LessonRunner";
import { NavBar } from "./pages/NavBar";
import { mockContent } from "./helpers/mock-content";
import { seedLearner } from "./helpers/setup";

test.describe("Session 2 — Learning flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockContent(page);
  });

  test("content browser shows the bundled lesson tree", async ({ page }) => {
    const content = new ContentPage(page);
    await content.goto();
    await expect(content.tree).toBeVisible();
  });

  test("theory renders markdown as structured HTML (not raw text)", async ({
    page,
  }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    await content.goto();
    await content.openBundledLesson();
    await expect(lesson.theoryBody).toBeVisible();
    // Markdown → react-markdown → real elements (p / list / strong / heading).
    const structured = lesson.theoryBody.locator(
      "p, ul, ol, strong, h1, h2, h3",
    );
    expect(await structured.count()).toBeGreaterThan(0);
  });

  test("theory example link (if present) opens in a new tab", async ({
    page,
  }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    await content.goto();
    await content.openBundledLesson();
    // Scan the theory steps for an example link.
    let found = false;
    for (let i = 0; i < 40; i++) {
      if (await page.getByTestId("theory-example-link").count()) {
        found = true;
        break;
      }
      if (await lesson.summary.count()) break;
      if ((await lesson.detectKind()) !== "theory") {
        await lesson.answerCurrent();
      }
      await lesson.advance();
    }
    test.skip(!found, "no theory step carries an example_url in this set");
    const link = page.getByTestId("theory-example-link");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("read-aloud does not shift the theory layout (if a voice exists)", async ({
    page,
  }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    await content.goto();
    await content.openBundledLesson();
    const noVoice = await page.getByTestId("lesson-tts-novoice").count();
    const readAll = page.getByTestId("lesson-tts-readall");
    test.skip(
      noVoice > 0 || (await readAll.count()) === 0,
      "no TTS voice in headless chromium (lesson-tts-novoice)",
    );
    const before = await lesson.theoryBody.boundingBox();
    await readAll.click();
    const after = await lesson.theoryBody.boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Math.abs((after!.width ?? 0) - (before!.width ?? 0))).toBeLessThan(2);
  });

  test("matching: pair A→B and B→A (#509 bidirectional)", async ({ page }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    await content.goto();
    await content.openBundledLesson();
    const reached = await lesson.advanceUntil("matching");
    test.skip(!reached, "no matching exercise reached in this lesson");

    // A → B: left then right forms a pair (number badge appears).
    await page.getByTestId("matching-left-0").click();
    await page.getByTestId("matching-right-0").click();
    await expect(page.getByTestId("matching-pair-badge-1").first()).toBeVisible();

    // Undo by tapping the paired left again.
    await page.getByTestId("matching-left-0").click();
    await expect(page.getByTestId("matching-pair-badge-1")).toHaveCount(0);

    // B → A: right FIRST, then left — the #509 reverse-direction path.
    await page.getByTestId("matching-right-0").click();
    await page.getByTestId("matching-left-0").click();
    await expect(page.getByTestId("matching-pair-badge-1").first()).toBeVisible();
  });

  test("free-text: input + check shows feedback", async ({ page }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    await content.goto();
    await content.openBundledLesson();
    const reached = await lesson.advanceUntil("free_text");
    test.skip(!reached, "no free-text exercise reached in this lesson");
    await page.getByTestId("free-text-input").fill("Bonjour");
    await expect(lesson.check).toBeEnabled();
    await lesson.check.click();
    await expect(page.getByTestId("free-text-result")).toBeVisible();
  });

  test("matching tiles share a uniform height", async ({ page }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    await content.goto();
    await content.openBundledLesson();
    const reached = await lesson.advanceUntil("matching");
    test.skip(!reached, "no matching exercise reached in this lesson");
    const tiles = page.getByTestId(/^matching-left-\d+$/);
    const n = await tiles.count();
    test.skip(n < 2, "need ≥2 tiles to compare heights");
    const heights: number[] = [];
    for (let i = 0; i < n; i++) {
      const box = await tiles.nth(i).boundingBox();
      if (box) heights.push(Math.round(box.height));
    }
    const max = Math.max(...heights);
    const min = Math.min(...heights);
    expect(max - min).toBeLessThanOrEqual(2);
  });

  test("Enter shortcut: checks then advances", async ({ page }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    await content.goto();
    await content.openBundledLesson();
    const reached = await lesson.advanceUntil("free_text");
    test.skip(!reached, "no free-text exercise reached in this lesson");
    await page.getByTestId("free-text-input").fill("Bonjour");
    // Enter grades the answered exercise (the result surfaces).
    await page.getByTestId("free-text-input").press("Enter");
    await expect(page.getByTestId("free-text-result")).toBeVisible();
  });

  test("revisiting a graded step is read-only", async ({ page }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    // A learner must exist so step results persist (recordStepResult
    // no-ops for an anonymous visitor) → the revisit renders locked.
    await seedLearner(page);
    await content.goto();
    await content.openBundledLesson();
    // Grade the first exercise step, advance, then go back to it.
    const reached = await lesson.advanceUntil("matching");
    test.skip(!reached, "no matching exercise reached in this lesson");
    await lesson.pairAllMatching();
    await expect(lesson.check).toBeEnabled();
    await lesson.check.click();
    await expect(lesson.next).toBeVisible();
    await lesson.next.click();
    // Wait until we've actually left the matching step (its result is
    // persisted) before navigating back, so the revisit renders locked.
    await page.getByTestId("matching-exercise").waitFor({ state: "detached" });
    // Back to the completed step → no Check button (can't re-answer).
    await lesson.prev.click();
    await expect(lesson.next).toBeVisible();
    await expect(lesson.check).toHaveCount(0);
  });

  test("result screen: copy + save, XP gain, and header badge update", async ({
    page,
  }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    const nav = new NavBar(page);
    // A learner must exist so the XP award persists + the header badge
    // renders (both are no-ops / hidden for an anonymous visitor).
    await seedLearner(page);
    await content.goto();
    await content.openBundledLesson();

    await lesson.playToSummary();
    await expect(page.getByTestId("lesson-summary-score")).toBeVisible();
    await expect(page.getByTestId("lesson-summary-stars")).toBeVisible();
    // +N XP pill on the summary (the lesson has exercises → xp > 0).
    await expect(page.getByTestId("lesson-summary-xp")).toBeVisible();

    // Copy result (clipboard) — no throw.
    await page.getByTestId("lesson-summary-copy-result").click();
    // Save result as a markdown file (download event).
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("lesson-summary-download-result").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.md$/);

    // Mark complete → the XP award persists asynchronously. Wait for the
    // button to disappear (completion finished) before navigating, so the
    // award is committed to IndexedDB before the Dashboard re-reads it.
    await page.getByTestId("lesson-summary-mark-complete").click();
    await expect(page.getByTestId("lesson-summary-mark-complete")).toHaveCount(
      0,
    );
    // Check on the Dashboard, where the header isn't auto-hidden (the
    // lesson route slides it away on scroll).
    await page.goto("/dashboard");
    await expect(nav.xpBadge.first()).toBeVisible();
    await expect(nav.xpTotal.first()).not.toHaveText("0 XP");
  });
});
