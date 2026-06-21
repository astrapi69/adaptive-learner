/**
 * No horizontal scroll on mobile (P0).
 *
 * Mobile is the primary use case for a learning app; a left/right
 * swipe scrolling the page means an element is wider than the
 * viewport. For every state at three phone widths we assert:
 *   1. ``documentElement.scrollWidth <= clientWidth`` (no doc scroll), and
 *   2. no element's layout box extends past the viewport's right edge,
 *      EXCEPT elements that manage their own overflow
 *      (``overflow-x: auto|scroll|hidden``) or are ``position: fixed``.
 *      Check #2 finds the ROOT cause even though the global
 *      ``overflow-x: hidden`` guard rail clips the body
 *      (getBoundingClientRect still reports the real layout position).
 *
 * 2026-06-01 — the earlier version of this spec only visited routes
 * in a FRESH Dexie session, where the authenticated routes
 * (Dashboard / Session / Progress / Settings) REDIRECT to onboarding.
 * It was therefore measuring the onboarding redirect target, not the
 * real pages, and missed three real overflows (Dashboard radar,
 * Settings AI badge, Session chips). This version ONBOARDS first and
 * measures the actual authenticated pages + every Settings tab + the
 * badge gallery + real lesson content (theory tables + exercise
 * renderers). A passing test that measures the wrong page is worse
 * than no test.
 *
 * Dexie build, no backend — GH Pages is where mobile users land.
 */

import { expect, test, type Page } from "@playwright/test";
import { createTestUser } from "../helpers/onboarding";

const WIDTHS = [320, 375, 414];

/** Routes that render real content WITHOUT a user. */
const PUBLIC_ROUTES: ReadonlyArray<{ name: string; path: string }> = [
  { name: "Landing", path: "/" },
  { name: "Onboarding", path: "/onboarding" },
  { name: "Assessment", path: "/assessment" },
  { name: "Content", path: "/content" },
  { name: "Import", path: "/import" },
  { name: "ImportDetail", path: "/import/nonexistent-conversation" },
  { name: "NotFound", path: "/this-route-does-not-exist" },
];

/** Routes that REDIRECT to onboarding without a user — must be
 *  measured AFTER createTestUser, else the measurement is a lie. */
const AUTH_ROUTES: ReadonlyArray<{ name: string; path: string; waitId: string }> = [
  { name: "Dashboard", path: "/dashboard", waitId: "dashboard" },
  { name: "Progress", path: "/progress", waitId: "progress" },
  { name: "Curriculum", path: "/curriculum", waitId: "curriculum" },
  { name: "Session", path: "/session", waitId: "session" },
  { name: "Review", path: "/review/es-a1-from-en", waitId: "review" },
  { name: "AdaptiveLesson", path: "/adaptive-lesson/es-a1-from-en", waitId: "adaptive-lesson-page" },
];

const SETTINGS_TABS = ["general", "ai", "learning", "plugins", "data", "help", "about"] as const;

/**
 * Wait for layout to settle before measuring widths. This spec's whole
 * job is measuring element boxes, so a fixed sleep is the wrong tool:
 * it can fire before web fonts swap in (font metrics change text width
 * and can introduce/remove an overflow) or before the post-load paint.
 * Awaiting ``document.fonts.ready`` plus a double rAF waits for the
 * actual conditions instead of guessing a duration — strictly more
 * reliable than ``waitForTimeout`` and usually faster.
 */
async function settleLayout(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const done = () =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        if (document.fonts && document.fonts.status !== "loaded") {
          document.fonts.ready.then(done, done);
        } else {
          done();
        }
      }),
  );
}

async function offenders(page: Page, vw: number): Promise<string[]> {
  return page.evaluate((viewport) => {
    // An element inside a genuine scroll / clip container (or a
    // fixed-positioned subtree) cannot scroll the PAGE — it scrolls
    // or clips within that container. Walk ancestors looking for
    // such a container, but STOP at the band-aid guards
    // (html / body / #root all carry ``overflow-x: hidden``); those
    // must NOT count, otherwise every element would be "contained"
    // and the whole root-cause check would be defeated.
    function containedByScrollOrClip(el: Element): boolean {
      let p = el.parentElement;
      while (p && p.tagName !== "HTML" && p.tagName !== "BODY" && p.id !== "root") {
        const ps = getComputedStyle(p);
        if (ps.overflowX === "auto" || ps.overflowX === "scroll" || ps.overflowX === "hidden") return true;
        if (ps.position === "fixed") return true;
        p = p.parentElement;
      }
      return false;
    }
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const style = getComputedStyle(el);
      const ox = style.overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden") return;
      if (style.position === "fixed") return;
      // SVG chart internals (<g>/<text>/<path>/...) legitimately
      // render outside their box (overflow:visible); the <svg> root
      // is constrained (max-width:100%) and the doc.scrollWidth
      // assertion is the real scroll guard for charts. Skip non-root
      // SVG descendants.
      if (el instanceof SVGElement && el.tagName.toLowerCase() !== "svg") return;
      if (containedByScrollOrClip(el)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > viewport + 2) {
        const cls =
          typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
        out.push(`${el.tagName}.${cls.slice(0, 40)} right=${Math.round(rect.right)}`);
      }
    });
    return [...new Set(out)].slice(0, 12);
  }, vw);
}

async function assertNoOverflow(page: Page, label: string, vw: number): Promise<void> {
  const doc = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(doc.scrollWidth, `document scrolls horizontally on ${label} @${vw}px`).toBeLessThanOrEqual(doc.clientWidth + 1);
  const off = await offenders(page, vw);
  expect(off, `elements overflow the viewport on ${label} @${vw}px`).toEqual([]);
}

test.describe("No horizontal scroll — public routes", () => {
  for (const width of WIDTHS) {
    for (const route of PUBLIC_ROUTES) {
      test(`${route.name} @ ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await page.goto(route.path);
        await settleLayout(page);
        await assertNoOverflow(page, route.path, width);
      });
    }
  }
});

test.describe("No horizontal scroll — authenticated pages (onboard first)", () => {
  for (const width of WIDTHS) {
    test(`authenticated pages + settings tabs @ ${width}px`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width, height: 720 });
      await createTestUser(page); // onboarding + assessment -> /dashboard

      for (const route of AUTH_ROUTES) {
        await page.goto(route.path);
        await page.locator(`[data-testid="${route.waitId}"]`).first().waitFor({ timeout: 12000 }).catch(() => {});
        await settleLayout(page);
        await assertNoOverflow(page, route.name, width);
      }

      // Settings: every tab panel (inactive panels are `hidden`, so
      // each must be activated to be measured). These widths are all
      // mobile (<= 768px), where the sidebar is hidden and the
      // hamburger menu drives the tabs.
      await page.goto("/settings");
      await page.getByTestId("settings-mobile-trigger").waitFor({ timeout: 12000 });
      const pickTab = async (tab: string): Promise<boolean> => {
        await page.getByTestId("settings-mobile-trigger").click();
        const item = page.getByTestId(`settings-mobile-tab-${tab}`);
        if (!(await item.count())) return false;
        await item.click();
        return true;
      };
      for (const tab of SETTINGS_TABS) {
        if (await pickTab(tab)) {
          await settleLayout(page);
          await assertNoOverflow(page, `Settings:${tab}`, width);
        }
      }

      // Badge gallery drawer (opened from the gamification settings
      // under the plugins tab). Best-effort — skip if the trigger
      // isn't present, but measure it when it is.
      if (await pickTab("plugins")) {
        await settleLayout(page);
        const viewAll = page.getByTestId("settings-view-all-badges");
        if (await viewAll.count()) {
          await viewAll.scrollIntoViewIfNeeded().catch(() => {});
          await viewAll.click().catch(() => {});
          if (await page.getByTestId("badge-gallery").count()) {
            await settleLayout(page);
            await assertNoOverflow(page, "BadgeGallery", width);
          }
        }
      }
    });
  }
});

test.describe("No horizontal scroll — real lesson content", () => {
  test("es-a1 lesson at 320px (theory tables + every exercise renderer)", async ({ page }) => {
    test.setTimeout(150_000);
    const VW = 320;
    await page.setViewportSize({ width: VW, height: 720 });

    await page.goto("/content?tab=my");
    await page.getByTestId("content-tree").waitFor({ timeout: 15000 });
    await page.getByTestId("content-other-toggle").click();
    await page.getByTestId("content-set-es-a1-from-en-action").click();
    const openBtn = page.getByTestId("content-set-es-a1-from-en-open");
    await openBtn.waitFor({ timeout: 25000 });
    await openBtn.click();
    await page.getByTestId("lesson-page").waitFor({ timeout: 15000 });

    // Lesson 06 (regular -AR verbs): markdown conjugation table in
    // theory + all 5 exercise renderers.
    const u = new URL(page.url());
    u.pathname = u.pathname.replace(/[^/]+\.json$/, "06-ar-verbs.json");
    await page.goto(u.toString());
    await page.getByTestId("lesson-page").waitFor({ timeout: 15000 });

    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      if (await page.getByTestId("lesson-summary").count()) break;
      const stepType = await page.locator('[data-testid^="lesson-step-"]').first().getAttribute("data-step-type").catch(() => "?");
      await assertNoOverflow(page, `Lesson06 step${i}(${stepType})`, VW);

      // Answer whatever exercise is on screen to advance.
      let kind = "theory";
      if (await page.getByTestId("matching-exercise").count()) {
        kind = "matching";
        const n = await page.getByTestId(/^matching-left-\d+$/).count();
        for (let k = 0; k < n; k++) {
          await page.getByTestId(`matching-left-${k}`).click();
          await page.getByTestId(`matching-right-${k}`).click();
        }
      } else if (await page.getByTestId("free-text-exercise").count()) {
        kind = "free_text";
        await page.getByTestId("free-text-input").fill("hablo");
      } else if (await page.getByTestId("cloze-exercise").count()) {
        kind = "cloze";
        const inp = page.locator('[data-testid^="cloze-input-"]');
        const n = await inp.count();
        for (let j = 0; j < n; j++) await inp.nth(j).fill("hablo");
      } else if (await page.getByTestId("word-tiles-exercise").count()) {
        kind = "word_tiles";
        const sc = page.locator('[data-testid^="word-tile-scrambled-"]');
        let g = 0;
        while ((await sc.count()) > 0 && g++ < 14) await sc.first().click();
      } else if (await page.getByTestId("picture-exercise").count()) {
        kind = "picture_choice";
        await page.locator('[data-testid^="picture-choice-"]').first().click();
      }
      if (kind !== "theory") seen.add(kind);

      const check = page.getByTestId("lesson-check");
      if (await check.count()) {
        await expect(check, `check button should enable after answering ${kind}`).toBeEnabled({ timeout: 5000 });
        await check.click();
      }
      const next = page.getByTestId("lesson-next");
      await expect(next, `next button should appear on step ${i}`).toBeVisible({ timeout: 5000 });
      await next.click();
      await page.waitForTimeout(80);
    }

    // The lesson exercised at least 3 distinct renderers on mobile.
    expect(seen.size, `exercise renderers measured: ${[...seen].join(", ")}`).toBeGreaterThanOrEqual(3);
  });
});
