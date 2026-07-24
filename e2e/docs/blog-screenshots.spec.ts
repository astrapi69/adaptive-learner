/**
 * Capture the lesson-creator screenshots used by the engine blog series
 * (learn-content-engine, docs/blog/create-a-lesson-in-the-app.md, part 3).
 *
 * This is a WRITER, not a gate: it asserts only enough to prove it captured
 * the intended surface (a missing picker or a renamed testid must fail loudly
 * rather than silently producing a screenshot of the wrong screen), then
 * writes PNGs for a human to pick from. No baseline, no diff.
 *
 * Run it whenever the creator UI changes in a way an article shows. The
 * screenshots it replaces were previously produced by an ad-hoc script that
 * was rewritten from scratch twice; this file exists so there is no third time.
 */

import {mkdirSync} from "node:fs";
import {join} from "node:path";

import {test, expect, type Page} from "@playwright/test";

import {DOCS_LANG} from "../playwright.docs.config";

const OUT = join(__dirname, "output", DOCS_LANG);

/** Cards for the running example of the article ("Ordering coffee"). */
const CARDS = [
    ["coffee", "der Kaffee", "A coffee, please."],
    ["please", "bitte", "Please wait here."],
    ["the bill", "die Rechnung", "The bill, please."],
    ["milk", "die Milch", "Milk with the coffee?"],
] as const;

test.beforeAll(() => {
    mkdirSync(OUT, {recursive: true});
});

/**
 * A string that only the BACKEND catalog can supply, per language. The
 * hardcoded first-paint fallbacks do not cover the card step, so seeing this
 * proves ``/api/i18n/{lang}`` was actually reached. Without the backend a
 * German run rendered German navigation and English content, which looked like
 * an i18n gap and was not one.
 */
const CATALOG_PROOF = {
    en: "Add vocabulary cards",
    de: "Vokabelkarten hinzufügen",
}[DOCS_LANG];

/** Open the creator with the UI language pinned to the run's DOCS_LANG. */
async function openCreator(page: Page): Promise<void> {
    await page.addInitScript((lang: string) => {
        localStorage.setItem("adaptive-learner.language", lang);
    }, DOCS_LANG);
    await page.goto("/create-lesson", {waitUntil: "networkidle"});
    await expect(page.getByTestId("create-lesson-title")).toBeVisible();
    // A newer-release banner (DesktopUpdateHost) overlays the wizard's bottom
    // edge when the deployed version lags the latest release: it intercepts
    // the Next click and would sit in every screenshot. Dismiss it for the
    // session; "Later" also persists the dismissed version.
    const updateBanner = page.getByTestId("desktop-update-banner");
    if (await updateBanner.isVisible().catch(() => false)) {
        await page.getByTestId("desktop-update-banner-later").click();
        await expect(updateBanner).toBeHidden();
    }
}

/** Scroll to the top so the page header is never clipped, then write the PNG. */
async function shot(page: Page, name: string): Promise<void> {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({path: join(OUT, `${name}.png`)});
}

/**
 * Pick a value in one of the language dropdowns. These are Radix comboboxes
 * (``button[role=combobox]`` plus a portalled listbox), NOT native selects, so
 * ``selectOption`` silently does nothing here: open it and click the option.
 * Asserting the trigger afterwards is the point: a silent no-op once shipped
 * two published screenshots with the wrong language pair.
 */
async function pickLanguage(page: Page, testId: string, label: string): Promise<void> {
    await page.getByTestId(testId).click();
    await page.getByRole("option", {name: label, exact: true}).click();
    await expect(page.getByTestId(testId)).toContainText(label);
}

async function fillMetadata(page: Page, title: string, native: string): Promise<void> {
    await page.getByTestId("create-lesson-title").fill(title);
    await page.getByTestId("create-lesson-title-native").fill(native);
    // The language names in these dropdowns are NOT translated: both the
    // English and the German UI list them as "English", "German", and so on.
    // So the same labels work for every DOCS_LANG.
    await pickLanguage(page, "create-lesson-target-lang", "English");
    await pickLanguage(page, "create-lesson-source-lang", "German");
}

test("captures the extension-authoring path", async ({page}) => {
    await openCreator(page);
    await fillMetadata(page, "Coffee shop: advanced practice", "Im Café: erweiterte Übungen");
    await page.getByTestId("create-lesson-templates").scrollIntoViewIfNeeded();
    await shot(page, "e1-extensions-entry");

    await page.getByTestId("template-extensions").click();
    await expect(page.getByTestId("create-lesson-extension-step")).toBeVisible();

    await page.getByTestId("extension-add").click();
    const picker = page.getByTestId("extension-add-picker");
    await expect(picker).toBeVisible();
    // Guards the article's central claim: all five adopted types are offered.
    await expect(picker.getByRole("button")).toHaveCount(6); // 5 types + Cancel
    await shot(page, "e2-type-picker");

    await page.getByTestId("extension-add-type-dictation").click();
    const editor = page.locator('[data-testid^="exercise-ext-editor-"]').first();
    await expect(editor).toBeVisible();
    const id = (await editor.getAttribute("data-testid"))!.replace("exercise-ext-editor-", "");

    await page.getByTestId(`exercise-ext-prompt-${id}`).fill("Listen and write the sentence.");
    await page.getByTestId(`exercise-ext-dict-audio-${id}`).fill("assets/audio/coffee-please.mp3");
    for (const accepted of ["A coffee, please.", "a coffee please"]) {
        await page.getByTestId(`exercise-ext-dict-accept-${id}-input`).fill(accepted);
        await page.getByTestId(`exercise-ext-dict-accept-${id}-add`).click();
    }
    await shot(page, "e3-dictation-fields");
});

test("captures the core card and exercise steps", async ({page}) => {
    await openCreator(page);
    await fillMetadata(page, "Ordering coffee", "Kaffee bestellen");
    await page.getByTestId("create-lesson-templates").scrollIntoViewIfNeeded();
    await shot(page, "s1-metadata");

    // Testid, not the label: the German catalog has both "Weiter" (next) and
    // "Weiter bearbeiten" (keep editing), so a name regex is ambiguous once
    // the backend catalog is loaded.
    const next = page.getByTestId("create-lesson-next");
    await next.click();
    await expect(page.getByTestId("card-front-input")).toBeVisible();
    // The capture is only usable if the UI really rendered in DOCS_LANG. This
    // string comes from the backend catalog, so it fails loudly when the
    // catalog is unreachable instead of writing English screenshots labelled
    // German.
    await expect(page.getByText(CATALOG_PROOF, {exact: false}).first()).toBeVisible();

    for (const [front, back, example] of CARDS) {
        await page.getByTestId("card-front-input").fill(front);
        await page.getByTestId("card-back-input").fill(back);
        await page.getByTestId("card-example-input").fill(example);
        await page.getByTestId("card-add-button").click();
    }
    await expect(page.getByTestId("card-count")).toContainText(String(CARDS.length));
    await shot(page, "s2-cards");

    await next.click();
    await expect(page.getByTestId("exercise-gen-config")).toBeVisible();
    await shot(page, "s3-exercises-config");

    await page.getByTestId("exercise-generate").click();
    // Count the rendered entries rather than parsing the label: "10 exercises"
    // contains the character "0", so a text assertion here reads as empty.
    await expect(page.getByTestId("exercise-list").locator("li")).not.toHaveCount(0);
    await shot(page, "s3-exercises");

    await page.getByTestId("exercise-add").click();
    await expect(page.getByTestId("exercise-add-picker")).toBeVisible();
    await shot(page, "s3-manual-add");
    await page.getByTestId("exercise-add-cancel").click();

    await next.click();
    await expect(page.getByTestId("create-lesson-checklist")).toBeVisible();
    await shot(page, "s4-review");

    // Edit mode reuses this same wizard, so the article's last screenshot needs
    // a lesson that already exists. Save one, and take its identifiers from the
    // SAVE RESPONSE rather than guessing a slug: the id is assigned by the
    // storage layer, and awaiting the response also guarantees the lesson is
    // persisted before the edit route asks for it. An earlier attempt that
    // navigated straight after the click found nothing to load.
    const savedEntry = page.waitForResponse(
        (response) =>
            response.url().includes("/user-sets") && response.request().method() === "POST",
    );
    await page.getByTestId("create-lesson-save-local").click();
    const entry = (await (await savedEntry).json()) as {source: string; id: string};

    await page.goto(
        `/create-lesson/edit/${encodeURIComponent(entry.source)}/${encodeURIComponent(entry.id)}`,
        {waitUntil: "networkidle"},
    );
    // Loaded means the wizard came back prefilled, not that it merely rendered.
    await expect(page.getByTestId("create-lesson-title")).toHaveValue("Ordering coffee", {
        timeout: 15_000,
    });
    for (let step = 0; step < 3; step++) await next.click();
    // Both only exist in edit mode (ReviewStep renders them behind editMode), so
    // together they refuse to capture the create flow while labelling it edit.
    await expect(page.getByTestId("create-lesson-edit-note")).toBeVisible();
    await expect(page.getByTestId("create-lesson-save-copy")).toBeVisible();
    await shot(page, "s7-edit-review");
});

test("captures the book-text path", async ({page}) => {
    await openCreator(page);
    await fillMetadata(page, "Attention and memory", "Aufmerksamkeit und Gedächtnis");
    await page.getByTestId("create-lesson-templates").scrollIntoViewIfNeeded();
    // The article shows the template row from the book path's point of view,
    // so this shot and e1 differ by which entry the reader is being pointed at.
    await shot(page, "s5-template-book");

    await page.getByTestId("template-knowledge-from-text").click();
    await expect(page.getByTestId("book-text-input")).toBeVisible();
    await page.getByTestId("book-text-input").fill(
        DOCS_LANG === "de"
            ? "Aufmerksamkeit ist die Zuwendung der Wahrnehmung auf einen Ausschnitt der Umwelt. " +
              "Sie ist begrenzt: Wer sich auf eine Sache konzentriert, nimmt andere schwächer wahr."
            : "Attention is the focusing of perception on part of the environment. " +
              "It is limited: concentrating on one thing weakens the perception of others.",
    );
    await page.getByTestId("book-title").fill(
        DOCS_LANG === "de" ? "Einführung in die Psychologie" : "Introduction to Psychology",
    );
    await page.getByTestId("book-author").fill("R. Atkinson");
    await expect(page.getByTestId("book-rights-hint")).toBeVisible();
    await shot(page, "s6-book-text");

    // #1927/#1953 — the second way into the same step: upload a book file and
    // pick sections (multi-select, batch generation). A generated markdown
    // "book" keeps the fixture inline; the front-matter chapter proves the
    // exclusion heuristic visibly (it arrives unchecked, with the hint).
    const chapter = (title: string, body: string) => `# ${title}\n\n${body.repeat(4)}`;
    const BOOK_MD =
        DOCS_LANG === "de"
            ? [
                  chapter("Vorwort", "Dank an alle Leserinnen und Leser dieser Einführung. "),
                  chapter(
                      "Kapitel 1: Aufmerksamkeit",
                      "Aufmerksamkeit ist die Zuwendung der Wahrnehmung auf einen Ausschnitt der Umwelt. Sie ist begrenzt und lässt sich lenken. ",
                  ),
                  chapter(
                      "Kapitel 2: Gedächtnis",
                      "Das Gedächtnis speichert Erfahrungen in mehreren Stufen, vom sensorischen Register bis zum Langzeitgedächtnis. ",
                  ),
              ].join("\n\n")
            : [
                  chapter("Preface", "Thanks to every reader of this introduction. "),
                  chapter(
                      "Chapter 1: Attention",
                      "Attention is the focusing of perception on part of the environment. It is limited and can be directed. ",
                  ),
                  chapter(
                      "Chapter 2: Memory",
                      "Memory stores experience in stages, from the sensory register to long-term memory. ",
                  ),
              ].join("\n\n");
    await page.getByTestId("book-upload-input").setInputFiles({
        name: DOCS_LANG === "de" ? "einfuehrung-psychologie.md" : "introduction-psychology.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(BOOK_MD, "utf-8"),
    });
    await expect(page.getByTestId("book-upload-picker")).toBeVisible();
    await expect(page.getByTestId("book-upload-section-list").locator("li")).toHaveCount(3);
    await shot(page, "s6b-book-upload");
});
