/**
 * "Meine Inhalte" list view — long-title overflow containment (#1392).
 *
 * Repro from the architect's iPhone screenshot: the row
 * "Portugiesisch (Brasilianisch) A1 (für Deutschsprachige)" ran past the
 * right viewport edge in the list view; the title did not truncate and
 * the three-dot set-actions menu (#1300) was pushed OUT of the viewport,
 * making status change / delete unreachable for that set. Rows with
 * medium-long titles showed their menu buttons further right than
 * short-title rows (no flush column).
 *
 * Root cause: the row ``<Link>`` was ``flex-1`` without ``min-w-0`` —
 * the classic #1328/#1329 class where a flex item's automatic minimum
 * size (content-based) defeats the nested ``truncate``.
 *
 * This spec measures REAL layout at the 375px iPhone viewport (the
 * happy-dom unit pins can only assert classes): no horizontal overflow,
 * the language badge visible, and the actions menu visible, inside the
 * viewport, clickable, and flush-aligned with a short-title row's menu.
 *
 * Dexie build, no backend. The pt-br set comes from the bundled content
 * checkout (local) or the runtime GitHub fetch (CI); when neither is
 * reachable the spec skips rather than measuring an empty list.
 */

import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding } from "../helpers";

/** The architect's repro set (longest title in the catalogue). */
const LONG_SET_ID = "pt-br-a1-from-de";
/** A short-title set used as the flush-column reference. */
const SHORT_SET_ID = "es-a2-from-en";

const VIEWPORT = { width: 375, height: 812 };

/** Wait for fonts + a settled layout before measuring boxes. */
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

/** Open /content?tab=my in LIST view. Returns false when the catalogue
 *  (bundled or runtime-fetched) did not load — the caller skips. */
async function openListView(page: Page): Promise<boolean> {
  await completeOnboarding(page);
  await page.goto("/content?tab=my");
  const toggle = page.getByTestId("content-view-list");
  try {
    await toggle.waitFor({ timeout: 20_000 });
  } catch {
    return false; // no downloaded/known sets -> no view toggle
  }
  await toggle.click();
  await page.getByTestId("content-list-view").waitFor({ timeout: 10_000 });
  if (!(await page.getByTestId(`content-list-set-${LONG_SET_ID}`).count())) {
    return false; // catalogue without the repro set (offline CI)
  }
  await settleLayout(page);
  return true;
}

test.describe("Content list view — long-title row (#1392)", () => {
  test("long title: no overflow, badge visible, menu clickable + flush @375px", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(VIEWPORT);
    const ready = await openListView(page);
    test.skip(!ready, "content catalogue not reachable in this environment");

    // 1. No horizontal overflow: neither the document nor the row itself
    //    scrolls sideways (scrollWidth <= clientWidth).
    const doc = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(doc.scrollWidth, "document scrolls horizontally").toBeLessThanOrEqual(
      doc.clientWidth + 1,
    );
    const row = page.getByTestId(`content-list-set-${LONG_SET_ID}`);
    const rowBox = await row.evaluate((el) => {
      const parent = el.parentElement as HTMLElement;
      return { scrollWidth: parent.scrollWidth, clientWidth: parent.clientWidth };
    });
    expect(rowBox.scrollWidth, "row overflows its container").toBeLessThanOrEqual(
      rowBox.clientWidth + 1,
    );

    // 2. The title truncates (ellipsis) instead of widening the row.
    const title = row.locator("span").first();
    await expect(title).toHaveClass(/truncate/);

    // 3. The language badge stays visible.
    await expect(
      page.getByTestId(`content-list-set-${LONG_SET_ID}-langs`),
    ).toBeVisible();

    // 4. The three-dot menu is visible, INSIDE the viewport, and opens.
    const trigger = page.getByTestId(`set-actions-${LONG_SET_ID}`);
    await expect(trigger).toBeVisible();
    const box = await trigger.boundingBox();
    expect(box, "menu trigger has no layout box").not.toBeNull();
    expect(box!.x + box!.width, "menu trigger pushed past the viewport").toBeLessThanOrEqual(
      VIEWPORT.width + 1,
    );
    await trigger.click();
    await expect(
      page.getByTestId(`set-actions-menu-${LONG_SET_ID}`),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // 5. Flush column: the long-title row's menu sits at the same x as a
    //    short-title row's menu (the alignment half of the report).
    const shortTrigger = page.getByTestId(`set-actions-${SHORT_SET_ID}`);
    if (await shortTrigger.count()) {
      const shortBox = await shortTrigger.boundingBox();
      expect(shortBox).not.toBeNull();
      expect(Math.abs(box!.x - shortBox!.x), "menu buttons not flush-aligned").toBeLessThanOrEqual(1);
    }
  });
});
