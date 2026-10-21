/**
 * Shared E2E helper: save an Anthropic key the way a learner does, through
 * Settings > AI (Dexie build, no backend).
 *
 * Specs that drive an AI feature against a mocked provider need a stored key
 * first, and specs that test the key vault need one to export. Three specs
 * carried their own copy of these steps (#3806 added the third), so they live
 * here once.
 */

import {expect, type Page} from "@playwright/test";

/** A format-valid fake Anthropic key (``sk-ant-`` prefix, long enough for
 *  the form to enable Save). Never reaches a real provider. */
const FAKE_ANTHROPIC_KEY = "sk-ant-" + "a".repeat(95);

/** What the configured-providers overview shows for a provider without a
 *  key: the key vault renders U+2014, written as an escape so the source
 *  carries no dash character. */
const NO_KEY_PREVIEW = "\u2014";

/**
 * Open Settings > AI, enter ``key`` for Anthropic and save it. Resolves once
 * the configured-providers overview shows a key preview for Anthropic, i.e.
 * the key is stored. The save also runs the vault's key test (a model-list
 * request); a spec that cares routes the provider before calling this.
 *
 * @param page - A page with an onboarded learner (``createTestUser``).
 * @param key - The key to store; defaults to {@link FAKE_ANTHROPIC_KEY}.
 *
 * @example
 * await createTestUser(page);
 * await saveAnthropicKey(page);
 */
export async function saveAnthropicKey(
    page: Page,
    key: string = FAKE_ANTHROPIC_KEY,
): Promise<void> {
    // The API-key inputs live in the AI tab, which is hidden unless active,
    // so deep-link straight to it.
    await page.goto("/settings?tab=ai");
    const input = page.getByTestId("api-key-input-anthropic");
    await expect(input).toBeVisible({timeout: 15000});
    await input.fill(key);
    await page.getByTestId("api-key-save-anthropic").click();
    await expect(page.getByTestId("provider-overview-preview-anthropic")).not.toHaveText(
        NO_KEY_PREVIEW,
        {timeout: 15000},
    );
}
