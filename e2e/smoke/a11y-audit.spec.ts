/**
 * Accessibility audit (#246, infra block 10).
 *
 * Runs axe-core (WCAG 2.0 A + AA) over the critical routes inside the
 * smoke project. A learner is seeded once (serial mode, shared page) so
 * the learner-gated views (Dashboard / Learning Path / Progress) render
 * their real content instead of redirecting to onboarding.
 *
 * Triage policy (per the infra prompt):
 *   - Fix CRITICAL violations in code (button-name, image-alt, label, …).
 *   - A genuinely-cosmetic pre-existing violation may be parked in
 *     ``KNOWN_ISSUES`` (keyed by route -> axe rule ids) WITH an issue
 *     reference, until it is fixed. The allowlist only ever shrinks.
 *   - NEVER globally disable an axe rule to go green. Rules still run and
 *     report; the allowlist merely acknowledges a documented exception.
 *
 * The first run (which surfaces the real violation set to triage) is the
 * maintainer's E2E run; this spec + the dependency are the harness.
 */

import {expect, test, type BrowserContext, type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import {completeAssessment, completeOnboarding} from "../helpers";

/** Critical routes to audit (bare paths; the dev server serves at "/"). */
const ROUTES = [
    "/dashboard",
    "/learning-path",
    "/content",
    "/progress",
    "/settings",
    "/import",
    "/anki",
] as const;

/**
 * Documented, pre-existing, cosmetic violations tolerated PER ROUTE by
 * axe rule id. Empty by design — populate ONLY from a real run, each entry
 * carrying an issue reference, and shrink it as issues are fixed.
 *
 * Example (do not add without an issue):
 *   "/anki": ["color-contrast"], // #NNN — legacy badge, fix pending
 */
const KNOWN_ISSUES: Partial<Record<(typeof ROUTES)[number], string[]>> = {};

test.describe.configure({mode: "serial"});

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({browser}) => {
    // axe-core/playwright needs a page from an explicit context
    // (``page.context().browser()`` must resolve); ``browser.newPage()``
    // does not satisfy that. Issue #272.
    context = await browser.newContext();
    page = await context.newPage();
    await completeOnboarding(page);
    await completeAssessment(page);
    await page.waitForURL("**/dashboard", {timeout: 30_000});
});

test.afterAll(async () => {
    await page.close();
    await context.close();
});

for (const route of ROUTES) {
    test(`a11y: ${route}`, async () => {
        await page.goto(route);
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({page})
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();

        const allow = KNOWN_ISSUES[route] ?? [];
        const unexpected = results.violations.filter(
            (v) => !allow.includes(v.id),
        );

        const summary = unexpected
            .map(
                (v) =>
                    `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n` +
                    `    ${v.helpUrl}`,
            )
            .join("\n");

        expect(
            unexpected,
            `axe found ${unexpected.length} unexpected violation(s) on ${route}:\n${summary}`,
        ).toEqual([]);
    });
}
