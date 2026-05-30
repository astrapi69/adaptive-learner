/**
 * No horizontal scroll on mobile (P0 — EXP-018 follow-up).
 *
 * Mobile is the primary use case for a learning app; a left/right
 * swipe scrolling the page means an element is wider than the
 * viewport. This walks the nav-reachable routes at three common
 * phone widths and asserts:
 *   1. the document does not scroll horizontally
 *      (``documentElement.scrollWidth <= clientWidth``), and
 *   2. no element's layout box extends past the viewport's right
 *      edge — EXCEPT elements that manage their own overflow
 *      (``overflow-x: auto|scroll|hidden``, e.g. a deliberately
 *      scrollable tab bar / code block) or are ``position: fixed``
 *      (off-canvas drawers). Check #2 finds the ROOT cause even
 *      though the global ``overflow-x: hidden`` guard rail clips
 *      the body (getBoundingClientRect still reports the real
 *      layout position).
 *
 * Dexie build, no backend — GH Pages is where mobile users land.
 */

import {expect, test, type Page} from "@playwright/test";

const WIDTHS = [320, 375, 414];

const ROUTES: ReadonlyArray<{name: string; path: string}> = [
  {name: "Landing", path: "/"},
  {name: "Onboarding", path: "/onboarding"},
  {name: "Assessment", path: "/assessment"},
  {name: "Dashboard", path: "/dashboard"},
  {name: "Session", path: "/session"},
  {name: "Curriculum", path: "/curriculum"},
  {name: "Progress", path: "/progress"},
  {name: "Settings", path: "/settings"},
  {name: "Import", path: "/import"},
  {name: "Content", path: "/content"},
  {
    name: "Lesson",
    path: "/lesson/astrapi69--adaptive-learner-content/language-fr-a1/01-greetings.json",
  },
  {name: "Review", path: "/review/language-fr-a1"},
  {name: "AdaptiveLesson", path: "/adaptive-lesson/language-fr-a1"},
  {name: "ImportDetail", path: "/import/nonexistent-conversation"},
  {name: "NotFound", path: "/this-route-does-not-exist"},
];

async function overflowOffenders(page: Page, vw: number): Promise<string[]> {
  return page.evaluate((viewport) => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const style = getComputedStyle(el);
      const ox = style.overflowX;
      // Elements that manage their own overflow are allowed to be
      // wider than the viewport (they scroll internally).
      if (ox === "auto" || ox === "scroll" || ox === "hidden") return;
      if (style.position === "fixed") return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > viewport + 2) {
        const cls =
          typeof el.className === "string" ? el.className : "";
        out.push(
          `${el.tagName}.${cls.slice(0, 40)} right=${Math.round(rect.right)}`,
        );
      }
    });
    // De-dup + cap so the failure message stays readable.
    return [...new Set(out)].slice(0, 12);
  }, vw);
}

test.describe("No horizontal scroll (mobile)", () => {
  for (const width of WIDTHS) {
    for (const route of ROUTES) {
      test(`${route.name} @ ${width}px has no horizontal overflow`, async ({
        page,
      }) => {
        await page.setViewportSize({width, height: 720});
        await page.goto(route.path);
        // Let layout settle (lazy chunks, fonts, charts).
        await page.waitForTimeout(400);

        const docScroll = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          docScroll.scrollWidth,
          `document scrolls horizontally on ${route.path} @ ${width}px`,
        ).toBeLessThanOrEqual(docScroll.clientWidth + 1);

        const offenders = await overflowOffenders(page, width);
        expect(
          offenders,
          `elements overflow the viewport on ${route.path} @ ${width}px`,
        ).toEqual([]);
      });
    }
  }
});
