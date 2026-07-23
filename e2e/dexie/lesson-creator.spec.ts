/**
 * Lesson Creator (/create-lesson) — full build flow (E2E hardening).
 *
 * Dexie build, NO backend, no AI key (the exercise generator is the
 * deterministic offline module). Walks the 4-step wizard:
 *   1. Metadata (title; the language pair defaults to source != target)
 *   2. Card editor (add 4 cards — MIN_CARDS)
 *   3. Exercise generator (auto-generate >= 5 — MIN_EXERCISES)
 *   4. Save locally -> the lesson appears under "My Lessons" on /content.
 *
 * STABLE SELECTORS ONLY (Phase-B-proof): ``data-testid`` anchors,
 * step-indicator testids, and the /content route. No CSS-class or
 * DOM-structure assertions.
 */

import {expect, test, type Page} from "@playwright/test";

const CARDS = [
    {front: "Bonjour", back: "Guten Tag"},
    {front: "Merci", back: "Danke"},
    {front: "Oui", back: "Ja"},
    {front: "Non", back: "Nein"},
];

/** Fill step-1 metadata and advance. The language pair defaults to
 *  source != target, so only the title is required. */
async function fillMetadata(page: Page): Promise<void> {
    await page.getByTestId("create-lesson-title").fill("E2E Greetings");
    // The non-blocking same-language hint must NOT be showing (defaults
    // differ). A same-language pair is allowed (#1715) — it is a hint,
    // never a blocking error.
    await expect(
        page.getByTestId("create-lesson-same-language-hint"),
    ).toHaveCount(0);
    await page.getByTestId("create-lesson-next").click();
}

/** Add the four cards in the editor. */
async function addCards(page: Page): Promise<void> {
    for (const card of CARDS) {
        await page.getByTestId("card-front-input").fill(card.front);
        await page.getByTestId("card-back-input").fill(card.back);
        await page.getByTestId("card-add-button").click();
    }
    await page.getByTestId("create-lesson-next").click();
}

/** Generate exercises (bump the count slider so we comfortably clear
 *  MIN_EXERCISES) and advance. */
async function generateExercises(page: Page): Promise<void> {
    await expect(page.getByTestId("create-lesson-step-3")).toBeVisible();
    // Range input: set a healthy target before generating.
    await page.getByTestId("exercise-count-slider").fill("8");
    await page.getByTestId("exercise-generate").click();
    await page.getByTestId("create-lesson-next").click();
    // If generation under-produced, the wizard would block on step 3
    // with create-lesson-exercise-error; reaching step 4 proves >= 5.
}

test.describe("Lesson Creator — build + save a lesson", () => {
    test("metadata -> 4 cards -> generate -> save -> appears in My Lessons", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto("/create-lesson");
        await expect(page.getByTestId("create-lesson-page")).toBeVisible({
            timeout: 15000,
        });
        // A restorable draft would prompt continue-or-fresh; on a clean
        // browser it won't, but be defensive.
        if (await page.getByTestId("create-lesson-draft-prompt").count()) {
            await page.getByTestId("create-lesson-draft-fresh").click();
        }

        await fillMetadata(page);
        await addCards(page);
        await generateExercises(page);

        // Step 4 — save locally.
        await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({
            timeout: 10000,
        });
        // #1929 — the quality checklist renders SIX rows again, including the
        // restored "Sprachpaar ist gueltig" row, which is green for the
        // supported de -> fr pair fillMetadata sets.
        await expect(
            page.getByTestId("create-lesson-checklist").locator("li"),
        ).toHaveCount(6);
        await expect(page.getByTestId("check-languagePair")).toHaveAttribute(
            "data-pass",
            "true",
        );
        await page.getByTestId("create-lesson-save-local").click();
        await expect(page.getByTestId("create-lesson-saved")).toBeVisible({
            timeout: 15000,
        });

        // Jump to the Content Browser and confirm the lesson is accessible.
        // #543 — it lands in "My Lessons" or, if it matches a published set,
        // folds into that tree node (EXP-026); accept either location.
        await page.getByTestId("create-lesson-to-browser").click();
        await expect(
            page
                .locator(
                    '[data-testid^="my-lesson-"], [data-testid^="folded-lesson-"]',
                )
                .first(),
        ).toBeVisible({timeout: 15000});

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("book-text path: entry -> paste + book fields -> no-key notice (#1743)", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto("/create-lesson");
        await expect(page.getByTestId("create-lesson-page")).toBeVisible({
            timeout: 15000,
        });
        if (await page.getByTestId("create-lesson-draft-prompt").count()) {
            await page.getByTestId("create-lesson-draft-fresh").click();
        }

        // Enter the book-text path from step 1.
        await page.getByTestId("create-lesson-title").fill("Pawlow");
        await page.getByTestId("template-knowledge-from-text").click();

        // The book step renders the paste field + book-metadata inputs.
        await expect(page.getByTestId("create-lesson-book-step")).toBeVisible();
        await expect(page.getByTestId("book-text-input")).toBeVisible();
        await expect(page.getByTestId("book-title")).toBeVisible();
        await expect(page.getByTestId("book-author")).toBeVisible();

        // Paste a chunk + book metadata, then attempt generation. In Dexie
        // mode with no AI key configured, the friendly no-key notice shows
        // instead of a crash (#1743 acceptance: no key -> clear message).
        await page
            .getByTestId("book-text-input")
            .fill(
                "Iwan Pawlow zeigte mit seinen Hunden die klassische Konditionierung.",
            );
        await page.getByTestId("book-title").fill("KI fuer Einsteiger");
        await page.getByTestId("book-generate").click();
        await expect(page.getByTestId("book-no-key")).toBeVisible({
            timeout: 10000,
        });

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("book-text path: file upload -> section picker fills the text field (#1927)", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto("/create-lesson");
        await expect(page.getByTestId("create-lesson-page")).toBeVisible({
            timeout: 15000,
        });
        if (await page.getByTestId("create-lesson-draft-prompt").count()) {
            await page.getByTestId("create-lesson-draft-fresh").click();
        }
        await page.getByTestId("create-lesson-title").fill("Upload-Test");
        await page.getByTestId("template-knowledge-from-text").click();
        await expect(page.getByTestId("create-lesson-book-step")).toBeVisible();

        // Upload a small Markdown book; the parser splits it at headings.
        const markdown = [
            "# Kapitel Eins",
            "Pawlow und die klassische Konditionierung.",
            "# Kapitel Zwei",
            "Skinner und die operante Konditionierung.",
        ].join("\n");
        await page.getByTestId("book-upload-input").setInputFiles({
            name: "buch.md",
            mimeType: "text/markdown",
            buffer: Buffer.from(markdown, "utf-8"),
        });

        // The picker lists both chapters; applying fills the empty field
        // without a confirmation dialog.
        await expect(page.getByTestId("book-upload-picker")).toBeVisible();
        const select = page.getByTestId("book-upload-section-select");
        await expect(select.locator("option")).toHaveCount(2);
        await select.selectOption({index: 1});
        await expect(page.getByTestId("book-upload-preview")).toContainText(
            "Skinner",
        );
        await page.getByTestId("book-upload-apply").click();
        await expect(page.getByTestId("book-text-input")).toHaveValue(
            /Skinner und die operante Konditionierung/,
        );

        // Applying another section over the now-non-empty field asks first.
        await select.selectOption({index: 0});
        await page.getByTestId("book-upload-apply").click();
        await expect(
            page.getByTestId("book-upload-replace-confirm"),
        ).toBeVisible();
        await page.getByTestId("book-upload-replace-confirm-confirm").click();
        await expect(page.getByTestId("book-text-input")).toHaveValue(
            /Pawlow und die klassische Konditionierung/,
        );

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("dictation via the core type picker -> saves + plays (#1895)", async ({
        page,
    }) => {
        // Device verification for #1895: a Diktat added through the MAIN
        // wizard's core-type picker must produce a lesson that carries
        // requires_extensions (else the save-time load guard throws) and
        // plays back. Whole flow in a real browser, Dexie build, no backend.
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto("/create-lesson");
        await expect(page.getByTestId("create-lesson-page")).toBeVisible({
            timeout: 15000,
        });
        if (await page.getByTestId("create-lesson-draft-prompt").count()) {
            await page.getByTestId("create-lesson-draft-fresh").click();
        }

        await fillMetadata(page);
        await addCards(page);

        // Step 3: auto-generate the core exercises (clears MIN_EXERCISES),
        // then add a dictation via the 7th picker option.
        await expect(page.getByTestId("create-lesson-step-3")).toBeVisible();
        await page.getByTestId("exercise-count-slider").fill("8");
        await page.getByTestId("exercise-generate").click();

        await page.getByTestId("exercise-add").click();
        await page.getByTestId("exercise-add-type-dictation").click();

        // The extension editor (reused ExtensionExerciseEditor + DictationFields)
        // opens; fill the shared prompt + the dictation fields.
        await page
            .locator('[data-testid^="exercise-ext-prompt-"]')
            .fill("Hoere zu und schreibe, was du hoerst.");
        // #1911 added an upload button (…-audio-upload-…) + hidden file input
        // (…-audio-file-…) beside the asset-path input, so the bare
        // "…-audio-" prefix overmatches (#1954). Pin the PATH input: its id
        // continues with the exercise id ("…-audio-ex-…").
        const audio = page.locator(
            '[data-testid^="exercise-ext-dict-audio-ex-"]',
        );
        await expect(audio).toBeVisible();
        await audio.fill("assets/audio/clip.mp3");
        const acceptInput = page.locator(
            '[data-testid^="exercise-ext-dict-accept-"][data-testid$="-input"]',
        );
        await acceptInput.fill("Bonjour");
        await page
            .locator(
                '[data-testid^="exercise-ext-dict-accept-"][data-testid$="-add"]',
            )
            .click();
        await page
            .locator('[data-testid^="exercise-ext-save-"]')
            .click();

        // Advance to step 4 — reaching it proves the dictation validated and
        // the mixed core+extension list cleared the step-3 gate.
        await page.getByTestId("create-lesson-next").click();
        await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({
            timeout: 10000,
        });

        // Save locally. If requires_extensions were NOT set, the build-time
        // load guard would throw and the "saved" panel would never appear.
        await page.getByTestId("create-lesson-save-local").click();
        await expect(page.getByTestId("create-lesson-saved")).toBeVisible({
            timeout: 15000,
        });

        // Play the saved lesson — it must load through the guard and render.
        await page.getByTestId("create-lesson-play").click();
        await expect(page.getByTestId("lesson-page")).toBeVisible({
            timeout: 15000,
        });

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("creator renders at 375px (mobile)", async ({page}) => {
        await page.setViewportSize({width: 375, height: 720});
        await page.goto("/create-lesson");
        await expect(page.getByTestId("create-lesson-page")).toBeVisible({
            timeout: 15000,
        });
        if (await page.getByTestId("create-lesson-draft-prompt").count()) {
            await page.getByTestId("create-lesson-draft-fresh").click();
        }
        await expect(
            page.getByTestId("create-lesson-step-indicator"),
        ).toBeVisible();
        await expect(page.getByTestId("create-lesson-title")).toBeVisible();
    });
});
