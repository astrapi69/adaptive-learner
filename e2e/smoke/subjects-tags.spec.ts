/**
 * Phase 28G / v1.15.0 — Subjects + tags filter bar.
 *
 * #931 — the Dashboard project filter (subjects + tags) is now hidden behind
 * the default-disabled ADVANCED_DASHBOARD feature flag: it is useless with a
 * single project and no project-creation UI. This spec pins that it is NOT
 * rendered on the Dashboard by default. The FilterBar component itself is still
 * covered by its unit test (DashboardFilterBar.test.tsx); re-enable + restore
 * the structural pins when multi-project lands.
 */

import {expect, test} from "@playwright/test";

import {createTestUser} from "../helpers";

test.describe("Subjects + tags filter bar", () => {
    test("Dashboard hides the project filter bar by default (#931)", async ({
        page,
    }) => {
        await createTestUser(page, {name: "Subjects-Tags E2E"});

        await page.waitForURL("**/dashboard");
        await expect(page.getByTestId("dashboard")).toBeVisible({
            timeout: 15_000,
        });
        // The filter bar is gated off until multi-project exists.
        await expect(page.getByTestId("dashboard-filter-bar")).toHaveCount(0);
    });
});
