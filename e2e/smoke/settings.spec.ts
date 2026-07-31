/**
 * Settings > AI smoke (#2177 rewrite of the Phase 6D spec).
 *
 * The old spec asserted the pre-v2.5.0 UI (a bare provider <select>);
 * the AI tab is the key-vault UI since v2.5.0 (@astrapi69/ai-key-vault-react
 * AiSettingsPanel). Rewritten against the current contract:
 *
 *   - a format-valid key (anthropic: prefix sk-ant-, min length 40) shows
 *     the live format-ok signal and saves; the Delete affordance proves
 *     the stored state,
 *   - a second saved provider appears in the configured-providers
 *     overview, and the active provider switches via the Active-provider
 *     select, reflected by the overview row's Active badge.
 *
 * Key values never leave the test process; the backend stores them
 * Fernet-encrypted and only ever returns has-key flags plus a masked
 * preview. No real provider call happens.
 */

import {expect, test} from "@playwright/test";

import {completeOnboarding} from "../helpers/onboarding";

// Format-valid fakes per the vault's BUILTIN_PROVIDERS rules.
const ANTHROPIC_FAKE = "sk-ant-e2e-smoke-000000000000000000000000000000";
const OPENAI_FAKE = "sk-e2e-smoke-00000000";

test.describe("Settings", () => {
    test("saves API keys + switches the active provider", async ({page}) => {
        await completeOnboarding(page);
        await page.goto("/settings?tab=ai");
        await expect(page.getByTestId("settings-panel-ai")).toBeVisible();

        // Save a format-valid anthropic key: the live format check goes
        // green, save flips the row to stored (Delete surfaces).
        await page.getByTestId("api-key-input-anthropic").fill(ANTHROPIC_FAKE);
        await expect(page.getByTestId("api-key-format-ok-anthropic")).toBeVisible();
        await page.getByTestId("api-key-save-anthropic").click();
        await expect(page.getByTestId("api-key-delete-anthropic")).toBeVisible({
            timeout: 10_000,
        });

        // Second provider, so the active choice is a real choice. Once a
        // key exists the panel shows the configured-providers overview;
        // an unconfigured provider's input opens via its Add-key button.
        // The first save kicks off an async auto key-test whose result
        // re-renders the panel and can fold a freshly opened edit row
        // shut mid-flow - so the whole open/fill/save step retries as a
        // unit until the stored state is real (saving the same key twice
        // is an idempotent overwrite).
        await expect(async () => {
            if (!(await page.getByTestId("api-key-input-openai").isVisible())) {
                await page.getByTestId("provider-overview-edit-openai").click();
            }
            await page.getByTestId("api-key-input-openai").fill(OPENAI_FAKE);
            const save = page.getByTestId("api-key-save-openai");
            await expect(save).toBeEnabled({timeout: 2000});
            await save.click();
            // Saving from the Add-key flow folds the edit row back into
            // the overview; stored state = the row's Remove-key action.
            await expect(page.getByTestId("provider-overview-delete-openai")).toBeVisible({
                timeout: 4000,
            });
        }).toPass({timeout: 30_000});

        // Both providers sit in the configured-providers overview; the
        // Active badge starts on the default provider (anthropic).
        await expect(page.getByTestId("provider-overview-row-anthropic")).toBeVisible();
        await expect(page.getByTestId("provider-overview-row-openai")).toBeVisible();
        await expect(page.getByTestId("provider-overview-badge-anthropic")).toBeVisible();

        // Switch the active provider via the per-row radio; the Active
        // badge moves to openai, and no error toast fires.
        // The Active-provider select drives the switch (the per-row radio
        // is a controlled mirror of the same setting). The panel's busy
        // guard silently swallows the change while the post-save auto
        // key-test is in flight, so the switch retries until the Active
        // badge actually moves.
        await expect(async () => {
            await page.getByTestId("settings-provider").selectOption("openai");
            await expect(page.getByTestId("provider-overview-badge-openai")).toBeVisible({
                timeout: 3000,
            });
        }).toPass({timeout: 30_000});
        await expect(page.getByTestId("provider-overview-badge-anthropic")).toHaveCount(0);
        await expect(page.locator(".Toastify__toast--error")).toHaveCount(0);
    });
});
