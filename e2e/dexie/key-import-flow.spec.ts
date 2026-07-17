/**
 * AI key import — link from the AI tab, paste-content import, and reactive
 * refresh after import (#1765). Dexie build, NO backend.
 *
 * Covers the three device-verification cases:
 *   1. The "Import" action in the Configured AI providers panel navigates to
 *      Data → key vault and scrolls its Import block into view.
 *   2. A key exported from KeyVaultSection can be re-imported by PASTING the
 *      envelope text (no file), with the passphrase, through the SAME import
 *      path as the file upload.
 *   3. After a successful paste-import the AI tab shows the provider as
 *      configured immediately, WITHOUT a reload (the reactivity fix).
 *   4. Invalid pasted JSON shows a clear inline error and keeps Import
 *      disabled.
 *
 * Stable selectors only (data-testid), no CSS/DOM-structure assertions.
 */

import { expect, test } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";

const PASSPHRASE = "correct-horse-1";
// Format-valid Anthropic key (sk-ant- prefix, >= 40 chars) so Save is enabled.
const ANTHROPIC_KEY = "sk-ant-api03-" + "e2eROUNDTRIP".repeat(6);

/** Save an Anthropic key in the AI tab (Dexie storage), used as the export
 *  source for the round-trip. */
async function saveAnthropicKey(page: import("@playwright/test").Page) {
  await page.goto("/settings?tab=ai");
  const input = page.getByTestId("api-key-input-anthropic");
  await expect(input).toBeVisible({ timeout: 15000 });
  await input.fill(ANTHROPIC_KEY);
  await page.getByTestId("api-key-save-anthropic").click();
  // The overview row shows the provider as active/configured.
  await expect(
    page.getByTestId("provider-overview-preview-anthropic"),
  ).not.toHaveText("—", { timeout: 15000 });
}

test.describe("AI key import flow (#1765)", () => {
  test("Import button on the AI tab jumps to the Data import block", async ({
    page,
  }) => {
    await createTestUser(page);
    await page.goto("/settings?tab=ai");
    await page.getByTestId("configured-providers-import").click();

    // Lands on the Data tab with the key-vault IMPORT block visible.
    await expect(page.getByTestId("settings-tab-data")).toHaveAttribute(
      "aria-current",
      "page",
      { timeout: 15000 },
    );
    await expect(page.getByTestId("key-vault-import")).toBeVisible();
    await expect(page.getByTestId("key-vault-import-text")).toBeVisible();
  });

  test("invalid pasted JSON shows an inline error and keeps Import disabled", async ({
    page,
  }) => {
    await createTestUser(page);
    await page.goto("/settings?tab=data");
    const textarea = page.getByTestId("key-vault-import-text");
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await textarea.fill("{ this is not a key file }");
    await page.getByTestId("key-vault-import-pass").fill(PASSPHRASE);

    // Language-agnostic signals (the gate seeds a German locale): the textarea
    // is marked invalid, the inline error paragraph has content, and Import
    // stays disabled.
    await expect(textarea).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("key-vault-import-text-error")).not.toBeEmpty();
    await expect(page.getByTestId("key-vault-import-button")).toBeDisabled();
  });

  test("paste-import writes the key and the AI tab reflects it without reload", async ({
    page,
  }) => {
    await createTestUser(page);
    await saveAnthropicKey(page);

    // Export the encrypted vault and capture the downloaded envelope text.
    await page.goto("/settings?tab=data");
    await page.getByTestId("key-vault-export-pass").fill(PASSPHRASE);
    await page.getByTestId("key-vault-export-confirm").fill(PASSPHRASE);
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("key-vault-export-button").click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const envelope = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (c) => chunks.push(Buffer.from(c)));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      stream.on("error", reject);
    });
    expect(envelope).toContain("adaptive-learner-keys");

    // Remove the key (on the AI tab, with confirmation) so a stale render
    // would show the empty placeholder.
    await page.goto("/settings?tab=ai");
    await page.getByTestId("provider-overview-delete-anthropic").click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(
      page.getByTestId("provider-overview-preview-anthropic"),
    ).toHaveText("—", { timeout: 15000 });

    // Paste the captured envelope + passphrase and import.
    await page.goto("/settings?tab=data");
    await page.getByTestId("key-vault-import-text").fill(envelope);
    await page.getByTestId("key-vault-import-pass").fill(PASSPHRASE);
    const importButton = page.getByTestId("key-vault-import-button");
    await expect(importButton).toBeEnabled();
    await importButton.click();
    await expect(page.locator(".Toastify__toast--success")).toBeVisible({
      timeout: 15000,
    });

    // WITHOUT a reload: switch to the AI tab; the provider is configured again
    // (masked preview shown, not the "—" empty placeholder — language-agnostic).
    await page.getByTestId("settings-tab-ai").click();
    await expect(
      page.getByTestId("provider-overview-preview-anthropic"),
    ).not.toHaveText("—", { timeout: 15000 });
  });
});
