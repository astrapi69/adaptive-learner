/**
 * App-level hit-test offset spec (#1569).
 *
 * Runs the same render-vs-hit-test measurement as the isolation harness, but on
 * the REAL app (Dexie-mode preview build, no backend — the GH-Pages shape the
 * bug is reported on). For each real interactive element on a route it asserts
 * that ``document.elementFromPoint`` at the element's rendered centre resolves
 * back into that element — i.e. no desync. This is where the real app's CSS can
 * reproduce what the isolated shell fixture does not.
 *
 * Non-destructive (no clicks), so it sweeps every visible interactive element.
 * Adjust the ROUTES / selector below to widen coverage (a lesson flow needs
 * content setup; Settings is the reported no-keyboard surface and reachable
 * from a fresh user).
 */

import { test, expect } from "@playwright/test";

import { createTestUser } from "../helpers/onboarding";
import { checkHitTest, type HitCheck } from "./measure";

const ROUTES = [
  { name: "Settings · General", path: "/settings?tab=general", ready: "settings-panel-general" },
  { name: "Settings · Learning", path: "/settings?tab=learning", ready: "settings-panel-learning" },
  { name: "Settings · Data", path: "/settings?tab=data", ready: "settings-panel-data" },
  { name: "Dashboard", path: "/dashboard", ready: "dashboard" },
  { name: "Content Hub", path: "/content", ready: "content-hub" },
];

// Elements a user taps. Scrolled to viewport centre before measuring, so a
// sticky header/footer does not create a false occlusion.
const INTERACTIVE =
  'button:visible, [role="switch"]:visible, [role="checkbox"]:visible, ' +
  'input:visible, select:visible, a[href]:visible';

test.describe("app-level hit-test offset (#1569)", () => {
  test.beforeEach(async ({ page }) => {
    await createTestUser(page);
  });

  for (const route of ROUTES) {
    test(`no render-vs-hit-test desync on ${route.name}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByTestId(route.ready)).toBeVisible({ timeout: 15_000 });

      const els = page.locator(INTERACTIVE);
      const count = await els.count();
      const failures: HitCheck[] = [];
      let measured = 0;
      for (let i = 0; i < count; i++) {
        const el = els.nth(i);
        if (!(await el.isVisible().catch(() => false))) continue;
        const res = await checkHitTest(el, `${route.name}#${i}`).catch(() => null);
        if (!res) continue;
        measured++;
        if (!res.ok) failures.push(res);
      }

      // eslint-disable-next-line no-console
      console.log(
        `[${route.name}] measured ${measured} interactive elements, ${failures.length} desynced`,
      );
      for (const f of failures) {
        // eslint-disable-next-line no-console
        console.log(
          `  DESYNC ${f.label} @(${f.cx},${f.cy}) -> ${f.resolvedTag}[${f.resolvedTestid}] ΔY=${f.deltaY}`,
        );
      }

      expect(measured, "should have measured interactive elements").toBeGreaterThan(0);
      expect(
        failures.map((f) => `${f.label} ΔY=${f.deltaY} -> ${f.resolvedTag}[${f.resolvedTestid}]`),
        `render-vs-hit-test desync on ${failures.length} element(s)`,
      ).toEqual([]);
    });
  }

  // The reported trigger is focusing a field (the on-screen keyboard). Headless
  // Chromium cannot open a real OSK, so this cannot reproduce the visual-viewport
  // offset itself — but it pins that FOCUS alone does not desync the elements
  // around a focused input, which is the state the device bug builds on.
  test("no desync of the controls around a focused input (Settings)", async ({ page }) => {
    await page.goto("/settings?tab=general");
    await expect(page.getByTestId("settings-panel-general")).toBeVisible({ timeout: 15_000 });
    const input = page
      .locator('input[type="text"]:visible, input:not([type]):visible, input[type="search"]:visible')
      .first();
    if ((await input.count()) === 0) {
      test.skip(true, "no text input on Settings general in this build");
      return;
    }
    await input.scrollIntoViewIfNeeded();
    await input.focus();
    // Re-measure every visible interactive element while the input holds focus.
    const els = page.locator(
      'button:visible, input:visible, select:visible, [role="switch"]:visible, ' +
        '[role="checkbox"]:visible, a[href]:visible',
    );
    const count = await els.count();
    const failures: HitCheck[] = [];
    let measured = 0;
    for (let i = 0; i < count; i++) {
      const el = els.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const res = await checkHitTest(el, `Settings(focused)#${i}`).catch(() => null);
      if (!res) continue;
      measured++;
      if (!res.ok) failures.push(res);
    }
    // eslint-disable-next-line no-console
    console.log(`[Settings · focused] measured ${measured}, ${failures.length} desynced`);
    expect(measured).toBeGreaterThan(0);
    expect(
      failures.map((f) => `${f.label} ΔY=${f.deltaY}`),
      `desync while an input is focused on ${failures.length} element(s)`,
    ).toEqual([]);
  });
});
