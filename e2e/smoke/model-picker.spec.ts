/**
 * Phase 28J / v1.15.0 — Model picker with API discovery.
 *
 * Verifies the v1.11.0 / Phase 24 model-picker mounts on
 * Settings and exposes the documented testid surface:
 *
 *   - ``model-picker-{provider}`` root.
 *   - ``model-picker-input-{provider}`` text input.
 *   - ``model-picker-toggle-{provider}`` dropdown button.
 *   - ``model-picker-default-hint-{provider}`` shows the
 *     fallback model id when no override is set.
 *   - Opening the dropdown surfaces the ``no-key`` empty
 *     state (since the E2E backend has no stored API key).
 *
 * Scope-limit note (v1.15.0 / Phase 28J): the live
 * "save API key → fetch /available-models → click option"
 * deep flow is NOT covered here. Reason: the Settings page
 * fires GET /api/settings/{user_id} twice on mount (React
 * strict-mode double effect); the backend's
 * get_or_create_settings race-conditions and one of the
 * two requests trips a UNIQUE constraint violation, blowing
 * up the test before the model picker can be exercised. The
 * race exists in the BACKEND, not the spec, and reproduces
 * outside Playwright when running the dev server. Filed as
 * ``28J-SETTINGS-RACE`` in the v1.15.0 release notes.
 */

import {expect, test} from "@playwright/test";

import {createTestUser} from "../helpers";

test.describe("Model picker", () => {
    test("picker mounts on Settings with default-hint + dropdown toggle", async ({
        page,
    }) => {
        await createTestUser(page, {name: "Model Picker E2E"});

        await page.getByTestId("nav-settings").click();
        await page.waitForURL("**/settings");

        // The model-picker for the active provider (anthropic
        // by default) mounts on Settings.
        await expect(
            page.getByTestId("model-picker-anthropic"),
        ).toBeVisible({timeout: 15_000});
        await expect(
            page.getByTestId("model-picker-input-anthropic"),
        ).toBeVisible();
        await expect(
            page.getByTestId("model-picker-toggle-anthropic"),
        ).toBeVisible();

        // No override set + no API key — the default-hint chip
        // displays the fallback model id.
        await expect(
            page.getByTestId("model-picker-default-hint-anthropic"),
        ).toBeVisible();
    });

    test("opening the dropdown without an API key surfaces the no-key state", async ({
        page,
    }) => {
        await createTestUser(page, {name: "Model Picker No-Key E2E"});

        await page.getByTestId("nav-settings").click();
        await page.waitForURL("**/settings");

        await page.getByTestId("model-picker-toggle-anthropic").click();
        await expect(
            page.getByTestId("model-picker-dropdown-anthropic"),
        ).toBeVisible();
        await expect(
            page.getByTestId("model-picker-no-key-anthropic"),
        ).toBeVisible();
    });
});
