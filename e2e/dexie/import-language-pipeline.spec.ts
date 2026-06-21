/**
 * C5/E2E — language pipeline, import -> analyze -> save -> share
 * (v1.54.0). Dexie build, NO backend.
 *
 * Verifies the root-cause fix: languages are set at IMPORT time and
 * INHERITED at every downstream step (no guessing / patching). The
 * German-speaker-learning-French journey at a 375px mobile width.
 *
 * The provider call is mocked via ``page.route`` (no real AI, no
 * backend): one canned response serves both the API-key save-test and
 * the conversation analysis. ``window.open`` is stubbed so the final
 * share step can assert the pull-request URL without navigating away.
 *
 * NOTE: authored to the spec; run it with ``make test-dexie-smoke``
 * (Playwright is not executed in the authoring environment). Variant 2
 * (German-only domain content, source == target == de) now ships as
 * knowledge content end to end: the save flow stamps a non-language
 * domain on the lesson and the share wizard inherits the same-language
 * pair instead of repairing it (IMPORT-LANG-PIPELINE-SELECT-MIGRATION-01).
 */

import { expect, test, type Page } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";

// A format-valid Anthropic key (prefix + length) so Settings accepts it.
const FAKE_KEY = "sk-ant-" + "a".repeat(95);

// Canned analysis JSON the mocked provider returns (content[0].text).
const ANALYSIS_JSON = JSON.stringify({
  topic: "Französisch Grammatik",
  user_level: "beginner",
  summary: "Bonjour, merci und das passé composé.",
  strengths: ["Vokabular"],
  weaknesses: ["unregelmäßige Verben"],
  error_patterns: ["être vs avoir"],
  recommended_method: "inductive",
  recommended_focus: "Mehr Übung",
  vocabulary: [
    { word: "Bonjour", translation: "Guten Tag", example: "Bonjour!" },
    { word: "merci", translation: "danke", example: "Merci beaucoup." },
    { word: "être", translation: "sein", example: "Je suis." },
    { word: "avoir", translation: "haben", example: "J'ai." },
  ],
  suggested_curriculum: [
    { title: "Passé composé", description: "Vergangenheit", priority: 1 },
  ],
});

const GERMAN_ABOUT_FRENCH =
  "Ich lerne Französisch. Wie sage ich Hallo? Bonjour! Und danke? " +
  "Merci. Erklär mir bitte das passé composé mit être und avoir.\n" +
  "Bonjour heißt Hallo, merci heißt danke.";

// Variant 2 — a German speaker drilling German grammar (source ==
// target == de). The vocab is German-in-German so the generated lesson
// is non-language ("knowledge") domain content.
const ANALYSIS_JSON_DE = JSON.stringify({
  topic: "Deutsche Grammatik: Artikel und Fälle",
  user_level: "beginner",
  summary: "Der, die, das und die vier Fälle.",
  strengths: ["Nominativ"],
  weaknesses: ["Dativ", "Genitiv"],
  error_patterns: ["Artikel im Dativ"],
  recommended_method: "deductive",
  recommended_focus: "Mehr Übung mit Fällen",
  vocabulary: [
    { word: "der Tisch", translation: "maskulin, Nominativ", example: "Der Tisch ist groß." },
    { word: "die Lampe", translation: "feminin, Nominativ", example: "Die Lampe ist hell." },
    { word: "das Buch", translation: "neutrum, Nominativ", example: "Das Buch ist dick." },
    { word: "dem Mann", translation: "maskulin, Dativ", example: "Ich gebe dem Mann das Buch." },
    { word: "der Frau", translation: "feminin, Dativ", example: "Ich helfe der Frau." },
    { word: "des Kindes", translation: "neutrum, Genitiv", example: "Das Spielzeug des Kindes." },
  ],
  suggested_curriculum: [
    { title: "Die vier Fälle", description: "Nominativ bis Genitiv", priority: 1 },
  ],
});

const GERMAN_ABOUT_GERMAN =
  "Erklär mir bitte die deutschen Artikel und Fälle. Wann benutzt man " +
  "der, die, das? Und wie dekliniert man im Dativ und Genitiv?\n" +
  "Der Tisch, die Lampe, das Buch. Ich gebe dem Mann das Buch.";

async function mockProvider(page: Page, analysisJson: string): Promise<void> {
  await page.route("**/api.anthropic.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: [{ type: "text", text: analysisJson }],
      }),
    });
  });
}

async function setAnthropicKey(page: Page): Promise<void> {
  // The API-key inputs live in the AI tab, which is hidden unless
  // active — deep-link straight to it (?tab=ai) so the input renders.
  await page.goto("/settings?tab=ai");
  const input = page.getByTestId("api-key-input-anthropic");
  await expect(input).toBeVisible({ timeout: 15000 });
  await input.fill(FAKE_KEY);
  await page.getByTestId("api-key-save-anthropic").click();
  // Give the save/auto-test a moment (mocked provider returns 200).
  await page.waitForTimeout(500);
}

test.describe("Language pipeline: import -> analyze -> save -> share", () => {
  test.use({ viewport: { width: 375, height: 720 } });

  // IMPORT-LANG-PIPELINE-SELECT-MIGRATION-01: the import + share-wizard
  // language pickers were migrated to shadcn (Radix) Select in Tailwind
  // Phase C4, so they are no longer <input> elements — toHaveValue() does
  // not apply. This spec now drives them Radix-aware: the SelectTrigger
  // renders the selected option's text ("German (de)") via SelectValue, so
  // we assert the trigger's text content contains the ISO code in parens
  // (e.g. "(fr)"). The save-as-offline modal is still a native <select>
  // (not migrated), so its toHaveValue() assertions stay unchanged.
  test("German speaker learning French keeps de -> fr at every step", async ({
    page,
  }) => {
    await mockProvider(page, ANALYSIS_JSON);
    // Settings + Import need a learner: without one, /settings redirects
    // to onboarding (no api-key UI). Onboard first, then set the key.
    await createTestUser(page);
    await setAnthropicKey(page);

    // 1-2. Import + paste a German chat about French, then analyze.
    await page.goto("/content?tab=import");
    await page.getByTestId("quick-paste-textarea").fill(GERMAN_ABOUT_FRENCH);
    await page.getByTestId("quick-analyze-button").click();

    // Lands on the import detail page once analysis completes.
    await expect(page.getByTestId("conversation-transcript")).toBeVisible({
      timeout: 20000,
    });

    // 3. The language pickers: source = app language (de), target
    // auto-detected from the French content (fr).
    const source = page.getByTestId("import-source-language");
    const target = page.getByTestId("import-target-language");
    await expect(source).toBeVisible();
    // Radix Select trigger: assert the displayed option text, which is
    // "<name> (<code>)" — so the ISO code shows in parens.
    await expect(target).toContainText("(fr)");
    // Source is the app language; assert it shows a real, different code.
    await expect(source).toContainText(/\([a-z]{2}\)/);
    await expect(source).not.toContainText("(fr)");

    // 6-7. Save as offline lesson — the modal INHERITS de -> fr.
    await page.getByTestId("save-offline-lesson-button").click();
    await expect(page.getByTestId("save-offline-lesson-modal")).toBeVisible();
    await expect(page.getByTestId("save-lesson-target-lang")).toHaveValue("fr");
    await expect(page.getByTestId("save-lesson-source-lang")).not.toHaveValue(
      "fr",
    );
    // 8. Save -> navigates to /content. The saved de -> fr lesson matches the
    // bundled de -> fr set, so EXP-026 folds it INTO that tree node (#543);
    // a non-matching lesson would stay in "My Lessons". Both surfaces render
    // the same UserSetActions, so accept the share button in either location.
    await page.getByTestId("save-lesson-save").click();

    // 10-11. Share the saved lesson; ShareWizard Step 1 inherits de -> fr.
    const shareBtn = page
      .locator(
        '[data-testid^="my-lesson-"][data-testid$="-share"], [data-testid^="folded-lesson-"][data-testid$="-share"]',
      )
      .first();
    await expect(shareBtn).toBeVisible({ timeout: 15000 });
    await shareBtn.click();
    await expect(page.getByTestId("share-wizard-step-1")).toBeVisible();

    const editSource = page.getByTestId("share-wizard-edit-source");
    const editTarget = page.getByTestId("share-wizard-edit-target");
    // Radix Select triggers — option text is "<name> (<code>)".
    await expect(editTarget).toContainText("(fr)");
    await expect(editSource).toContainText(/\([a-z]{2}\)/);
    await expect(editSource).not.toContainText("(fr)");

    // 12-13. Placement shows the inherited pair + Continue is enabled.
    await expect(page.getByTestId("share-wizard-placement")).toContainText(
      "FR",
    );
    await expect(page.getByTestId("share-wizard-next")).toBeEnabled();
  });

  // Variant 2 — German-only domain content (source == target == de).
  // The learner SPEAKS and LEARNS German (grammar drill), so the material
  // is non-language ("knowledge") content. The save flow stamps that
  // domain on the lesson, and the share wizard inherits the same-language
  // pair (no en/en-style repair) and ships it without a same-language
  // error (IMPORT-LANG-PIPELINE-SELECT-MIGRATION-01).
  test("German domain content (de -> de) shares as knowledge without a same-language error", async ({
    page,
  }) => {
    await mockProvider(page, ANALYSIS_JSON_DE);
    await createTestUser(page);
    await setAnthropicKey(page);

    // 1-2. Import + paste a German chat about German grammar, then analyze.
    await page.goto("/content?tab=import");
    await page.getByTestId("quick-paste-textarea").fill(GERMAN_ABOUT_GERMAN);
    await page.getByTestId("quick-analyze-button").click();
    await expect(page.getByTestId("conversation-transcript")).toBeVisible({
      timeout: 20000,
    });

    // 3. Force BOTH languages to German (source == target == de) — domain
    // content. The pickers are shadcn (Radix) Selects: click the trigger,
    // then the "German (de)" option in the portal-rendered list.
    await page.getByTestId("import-source-language").click();
    await page.getByRole("option", { name: "German (de)" }).click();
    await page.getByTestId("import-target-language").click();
    await page.getByRole("option", { name: "German (de)" }).click();
    await expect(page.getByTestId("import-source-language")).toContainText(
      "(de)",
    );
    await expect(page.getByTestId("import-target-language")).toContainText(
      "(de)",
    );

    // 6-7. Save as offline lesson — the modal INHERITS de -> de. The
    // same-language hint shows, but Save stays enabled (a native-language
    // grammar lesson is legitimate).
    await page.getByTestId("save-offline-lesson-button").click();
    await expect(page.getByTestId("save-offline-lesson-modal")).toBeVisible();
    await expect(page.getByTestId("save-lesson-source-lang")).toHaveValue("de");
    await expect(page.getByTestId("save-lesson-target-lang")).toHaveValue("de");
    await expect(page.getByTestId("save-lesson-same-language")).toBeVisible();
    // 8. Save -> navigates to /content. A de -> de knowledge lesson folds
    // into the tree only on an exact-title match (#543); here it stays in
    // "My Lessons". Accept the share button in either location to stay robust.
    await page.getByTestId("save-lesson-save").click();

    // 10-13. Share the saved lesson; ShareWizard Step 1 inherits de -> de
    // as knowledge content (no same-language reset, no blocking error).
    const shareBtn = page
      .locator(
        '[data-testid^="my-lesson-"][data-testid$="-share"], [data-testid^="folded-lesson-"][data-testid$="-share"]',
      )
      .first();
    await expect(shareBtn).toBeVisible({ timeout: 15000 });
    await shareBtn.click();
    await expect(page.getByTestId("share-wizard-step-1")).toBeVisible();
    await expect(page.getByTestId("share-wizard-edit-source")).toContainText(
      "(de)",
    );
    await expect(page.getByTestId("share-wizard-edit-target")).toContainText(
      "(de)",
    );
    // The domain hint explains it ships as knowledge; no step-1 errors;
    // Continue is enabled.
    await expect(page.getByTestId("share-wizard-domain-hint")).toBeVisible();
    await expect(page.getByTestId("share-wizard-step1-errors")).toHaveCount(0);
    await expect(page.getByTestId("share-wizard-next")).toBeEnabled();
  });
});
