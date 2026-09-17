/**
 * Settings tabs — sidebar/hamburger navigation + deep-link (E2E hardening).
 *
 * Dexie build, NO backend. Covers the 9-tab Settings page
 * (general / ai / learning / plugins / data / integrations / help /
 * diagnostics / about):
 *   - on desktop, the sidebar activates each tab (``aria-current="page"``)
 *     and reveals its panel,
 *   - a ``?tab=ai`` deep link opens the AI tab directly,
 *   - on mobile (≤768px) the hamburger menu drives the same tabs.
 *
 * STABLE SELECTORS ONLY (survives restyles): ``settings-tab-{tab}``
 * (desktop sidebar) / ``settings-mobile-tab-{tab}`` (mobile menu)
 * testids, per-panel ``data-testid`` anchors, ``aria-current``, and the
 * URL query string. No CSS-class or DOM-structure assertions.
 */

import {expect, test} from "@playwright/test";

import {createTestUser} from "../helpers/onboarding";

// Each tab + the stable testid that is only visible while that tab is
// the active one (the panels use the HTML ``hidden`` attribute).
// Source of truth for the tab set and its order: ``SETTINGS_TABS`` in
// ``frontend/src/pages/system/Settings.tsx`` (#2963). Every tab renders
// in the Dexie build (the panels are mounted unconditionally).
const TABS: {tab: string; panel: string}[] = [
    {tab: "general", panel: "settings-section-appearance"},
    {tab: "ai", panel: "settings-provider"},
    {tab: "learning", panel: "settings-panel-learning"},
    {tab: "plugins", panel: "settings-panel-plugins"},
    {tab: "data", panel: "settings-panel-data"},
    {tab: "integrations", panel: "settings-panel-integrations"},
    {tab: "help", panel: "settings-panel-help"},
    {tab: "diagnostics", panel: "settings-panel-diagnostics"},
    {tab: "about", panel: "settings-panel-about"},
];

test.describe("Settings — tabbed navigation", () => {
    test(`each of the ${TABS.length} tabs activates and shows its panel`, async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await createTestUser(page);
        await page.goto("/settings");
        // Desktop default viewport -> the sidebar nav is visible.
        await expect(page.getByTestId("settings-tabs")).toBeVisible({
            timeout: 15000,
        });

        // Drift guard (#2963): the rendered sidebar is the oracle. A tab
        // added to ``SETTINGS_TABS`` without an entry in ``TABS`` above
        // fails here naming the missing id, instead of silently going
        // unwalked. Scoped to the nav's buttons so no other prefixed
        // testid (``settings-tabs``, ``settings-group-*``) can leak in.
        const rendered = await page
            .getByTestId("settings-tabs")
            .locator('button[data-testid^="settings-tab-"]')
            .evaluateAll((buttons) =>
                buttons.map((button) => button.getAttribute("data-testid") ?? ""),
            );
        expect(rendered.sort()).toEqual(
            TABS.map(({tab}) => `settings-tab-${tab}`).sort(),
        );

        for (const {tab, panel} of TABS) {
            const trigger = page.getByTestId(`settings-tab-${tab}`);
            await trigger.click();
            // The active item marks itself (accessibility contract,
            // restyle-proof).
            await expect(trigger).toHaveAttribute("aria-current", "page");
            // Its panel is now the visible one.
            await expect(page.getByTestId(panel)).toBeVisible({
                timeout: 10000,
            });
        }

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("deep link ?tab=ai opens the AI tab directly", async ({page}) => {
        await createTestUser(page);
        await page.goto("/settings?tab=ai");

        await expect(page.getByTestId("settings-tab-ai")).toHaveAttribute(
            "aria-current",
            "page",
            {timeout: 15000},
        );
        await expect(page.getByTestId("settings-provider")).toBeVisible();
        // A different tab is NOT the current one.
        await expect(
            page.getByTestId("settings-tab-general"),
        ).not.toHaveAttribute("aria-current", "page");
    });

    test("tabs work at 375px via the hamburger menu (mobile)", async ({page}) => {
        await page.setViewportSize({width: 375, height: 720});
        await createTestUser(page);
        await page.goto("/settings");
        // The sidebar is hidden at mobile; the hamburger trigger drives
        // the same tabs.
        await expect(page.getByTestId("settings-mobile-trigger")).toBeVisible({
            timeout: 15000,
        });

        // Spot-check two tabs at mobile width: data (backup) + about.
        await page.getByTestId("settings-mobile-trigger").click();
        await page.getByTestId("settings-mobile-tab-data").click();
        await expect(page.getByTestId("settings-panel-data")).toBeVisible();

        await page.getByTestId("settings-mobile-trigger").click();
        await page.getByTestId("settings-mobile-tab-about").click();
        await expect(page.getByTestId("settings-panel-about")).toBeVisible();
    });
});
