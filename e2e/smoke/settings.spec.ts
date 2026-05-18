/**
 * Phase 6D smoke: Settings page — save an API key, see the
 * 'Active'/'Stored' badges flip, switch the active provider.
 *
 * The key value never leaves the test process; the backend
 * encrypts it via app.services.crypto and returns only the
 * has_*_key boolean flags. No real provider call happens.
 */

import {expect, test} from "@playwright/test";

import {completeOnboarding} from "../helpers/onboarding";

test.describe("Settings", () => {
    test("saves an API key + toggles the active provider", async ({page}) => {
        await completeOnboarding(page);
        await page.goto("/settings");
        await expect(page.getByTestId("settings")).toBeVisible();

        // Save a fake anthropic API key.
        await page
            .getByTestId("api-key-input-anthropic")
            .fill("sk-smoke-test-1234");
        await page.getByTestId("api-key-save-anthropic").click();
        // After save the status flips to 'set' and a Delete
        // button surfaces.
        await expect(page.getByTestId("api-key-delete-anthropic")).toBeVisible();

        // Active provider defaults to 'anthropic'; switch to openai.
        await page.getByTestId("settings-provider").selectOption("openai");
        // After the PATCH, the Active badge moves to openai.
        await expect(page.getByTestId("api-key-active-openai")).toBeVisible();
    });
});
