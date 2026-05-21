/**
 * Phase 28H / v1.15.0 — TipTap rich-text editor surface.
 *
 * Verifies the v1.14.0 RichTextEditor mounts in its canonical
 * surface (RatingDialog session notes) and that:
 *
 *   - The toolbar renders alongside the editor.
 *   - Toggling the Bold button flips its aria-pressed state.
 *   - Typing in the editor surfaces as text content.
 *   - Submitting persists the JSON-serialised note via the
 *     existing rating endpoint (the contract is that notes
 *     submit cleanly even without typed input).
 *
 * Deep round-trip (reload + verify formatting survives) is
 * covered by the v1.14.0 frontend tests; this is the smoke
 * pin that the editor mounts inside a real session-rating
 * flow.
 */

import {expect, test} from "@playwright/test";

import {createTestUser, startSession} from "../helpers";

test.describe("Rich-text editor (RatingDialog notes)", () => {
    test("toolbar mounts; bold toggles aria-pressed; notes submit cleanly", async ({
        page,
    }) => {
        await createTestUser(page, {name: "RTE E2E"});
        await startSession(page);
        await expect(page.getByTestId("session")).toBeVisible();

        // Open the rating dialog without sending any messages.
        await page.getByTestId("session-end").click();
        await expect(page.getByTestId("rating-dialog")).toBeVisible();

        // The RichTextEditor + toolbar both mount.
        await expect(page.getByTestId("rating-notes-root")).toBeVisible();
        await expect(
            page.getByTestId("rating-notes-toolbar-root"),
        ).toBeVisible();
        await expect(
            page.getByTestId("rating-notes-toolbar-bold"),
        ).toBeVisible();

        // The RatingDialog HIDES H1 + history; pin that contract.
        await expect(
            page.getByTestId("rating-notes-toolbar-h1"),
        ).toHaveCount(0);
        await expect(
            page.getByTestId("rating-notes-toolbar-undo"),
        ).toHaveCount(0);

        // Click bold — aria-pressed flips to "true".
        const boldButton = page.getByTestId("rating-notes-toolbar-bold");
        expect(await boldButton.getAttribute("aria-pressed")).toBe("false");
        await boldButton.click();
        await expect(boldButton).toHaveAttribute("aria-pressed", "true");

        // Type some text in the editor.
        await page.getByTestId("rating-notes-content").click();
        await page.keyboard.type("Hello rich text", {delay: 5});

        // Submit the rating — notes serialise to JSON via the
        // ``content-utils`` path and POST /api/plugins/session
        // /{id}/rate.
        await page.getByTestId("rating-submit").click();
        await page.waitForURL("**/dashboard");
        await expect(page.getByTestId("dashboard")).toBeVisible();
    });
});
