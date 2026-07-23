/**
 * Card image upload — Lesson Creator card editor (#1763 / #1764).
 *
 * Dexie build, NO backend, no AI key. Exercises the REAL browser-only
 * image pipeline that the unit tests (card-image.test.ts,
 * CardImageField.test.tsx) can only mock: a genuine file-input upload
 * decoded by ``new Image()`` and re-encoded through a real canvas
 * (``processCardImageFile``), the live 64x64 preview, the Remove control,
 * the unsupported-type inline error (role=alert), and the "Advanced:
 * asset path" fallback toggle.
 *
 * Scope note: the export -> re-import round-trip of an uploaded data-URI
 * image is pure serialization and stays covered at unit level
 * (card-image.test.ts + lesson-import.test.ts). This spec covers the
 * interactive, browser-dependent half that only runs in a real page.
 *
 * STABLE SELECTORS ONLY: the ``card-image-*`` testids (idPrefix "card"
 * on the add-form CardImageField) + the create-lesson step anchors.
 */

import {expect, test, type Page} from "@playwright/test";

/** A real, decodable 1x1 PNG. ``processCardImageFile`` loads it via
 *  ``new Image()`` and re-encodes it on a canvas, so the bytes must be a
 *  genuine image the browser can decode — not an arbitrary blob. */
const PNG_1x1_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** Reach the card editor (step 2), where the add-form CardImageField
 *  renders under the "card" testid prefix. */
async function openCardEditor(page: Page): Promise<void> {
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({
        timeout: 15000,
    });
    // A restorable draft would prompt continue-or-fresh; on a clean
    // browser it won't, but be defensive.
    if (await page.getByTestId("create-lesson-draft-prompt").count()) {
        await page.getByTestId("create-lesson-draft-fresh").click();
    }
    await page.getByTestId("create-lesson-title").fill("E2E Image Cards");
    await page.getByTestId("create-lesson-next").click();
    // Step 2 — the card editor add-form carries the image field.
    await expect(page.getByTestId("card-image-upload")).toBeVisible({
        timeout: 10000,
    });
}

test.describe("Card image upload (#1763/#1764)", () => {
    test("upload -> 64x64 preview -> Remove restores the upload button", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await openCardEditor(page);

        // Before upload: the upload button is shown, no preview.
        await expect(page.getByTestId("card-image-preview")).toHaveCount(0);

        // Upload a real PNG via the hidden file input (the visible
        // "Upload image" button just proxies a click to it).
        await page.getByTestId("card-image-file").setInputFiles({
            name: "card.png",
            mimeType: "image/png",
            buffer: Buffer.from(PNG_1x1_BASE64, "base64"),
        });

        // The canvas re-encode produces a data URI -> preview appears, the
        // upload button is replaced by Remove.
        const preview = page.getByTestId("card-image-preview");
        await expect(preview).toBeVisible({timeout: 10000});
        await expect(preview).toHaveJSProperty("tagName", "IMG");
        await expect(preview).toHaveAttribute("src", /^data:image\//);
        await expect(page.getByTestId("card-image-upload")).toHaveCount(0);

        // Remove clears it: back to the upload button, no preview.
        await page.getByTestId("card-image-remove").click();
        await expect(page.getByTestId("card-image-preview")).toHaveCount(0);
        await expect(page.getByTestId("card-image-upload")).toBeVisible();

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("unsupported file type shows an inline role=alert error, no crash", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await openCardEditor(page);

        // A text file is not an accepted card-image type
        // (ACCEPTED_CARD_IMAGE_TYPES = jpeg/png/webp) -> friendly inline
        // error, no preview, no crash.
        await page.getByTestId("card-image-file").setInputFiles({
            name: "notes.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("not an image", "utf-8"),
        });

        const err = page.getByTestId("card-image-error");
        await expect(err).toBeVisible({timeout: 5000});
        await expect(err).toHaveAttribute("role", "alert");
        await expect(page.getByTestId("card-image-preview")).toHaveCount(0);
        // The upload button is still there — the field recovered.
        await expect(page.getByTestId("card-image-upload")).toBeVisible();

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("Advanced asset-path toggle reveals the manual path field", async ({
        page,
    }) => {
        await openCardEditor(page);

        // The manual path input is hidden behind the Advanced toggle
        // (kept for repo-published sets that reference assets/ images).
        await expect(page.getByTestId("card-image-path")).toHaveCount(0);
        const toggle = page.getByTestId("card-image-path-toggle");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await toggle.click();

        const pathInput = page.getByTestId("card-image-path");
        await expect(pathInput).toBeVisible();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await pathInput.fill("img/bonjour.png");
        await expect(pathInput).toHaveValue("img/bonjour.png");
    });
});
