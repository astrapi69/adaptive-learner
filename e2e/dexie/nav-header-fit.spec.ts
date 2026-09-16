/**
 * Kopfzeile am Telefon mit vielen Abzeichen (#3123).
 *
 * Auf einem iPhone 14 Pro Max (430 px) stand oben links statt des
 * Menü-Knopfs nur ein Strich von wenigen Pixeln, das Logo fehlte ganz:
 * Hamburger und Logo waren die einzigen schrumpfbaren Flex-Kinder neben
 * einer Reihe nicht schrumpfbarer Abzeichen ("718 fällig",
 * "1 Aktualisierungen", "Stufe 1 / 0 XP"). Der Überlauf-Gate
 * (``no-horizontal-scroll.spec.ts``) sah nichts, weil nichts überlief -
 * die Leiste hatte ihre eigenen Knöpfe geopfert.
 *
 * Dieser Spec seedet echte Abzeichen (fällige Wiederholungen + XP) und
 * misst, was der Nutzer sieht: der Menü-Knopf hat seine volle Breite, das
 * Logo ist da, kein Kind der Leiste ragt über den rechten Rand, und die
 * Abzeichen zeigen am Telefon nur die Zahl. Die Breiten werden protokolliert
 * (Gate-Vertrag #2083 Punkt 4).
 */

import { expect, test } from "@playwright/test";

import { gotoDashboardWithDueReviews } from "../visual/helpers";

/** 375 = iPhone SE/Mini class, 430 = iPhone 14 Pro Max (the reported device). */
const WIDTHS = [375, 430];

for (const width of WIDTHS) {
  test.describe(`Phone header at ${width}px`, () => {
    test.use({ viewport: { width, height: 860 } });

    test("menu button and logo keep their size beside the badges", async ({ page }) => {
      const ready = await gotoDashboardWithDueReviews(page);
      test.skip(!ready, "bundled set has no matching exercise to seed due reviews");

      const nav = page.getByTestId("app-nav");
      const burger = page.getByTestId("nav-hamburger");
      const logo = nav.locator(".nav-brand img");
      await expect(burger).toBeVisible();
      await expect(logo).toBeVisible();

      const burgerBox = (await burger.boundingBox())!;
      const logoBox = (await logo.boundingBox())!;
      const children = await nav.evaluate((el) =>
        [...el.children]
          .filter((child) => getComputedStyle(child).position !== "absolute")
          .map((child) => {
            const box = child.getBoundingClientRect();
            return {
              testid: child.getAttribute("data-testid") ?? child.className,
              left: Math.round(box.left),
              right: Math.round(box.right),
              width: Math.round(box.width),
            };
          }),
      );
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      console.log(
        `[#3123] ${width}px: burger ${Math.round(burgerBox.width)}px, logo ${Math.round(
          logoBox.width,
        )}px, children ${JSON.stringify(children)}, doc ${overflow.scrollWidth}/${overflow.clientWidth}`,
      );

      // 2.75rem = 44px; a squeezed button read 3-5px in the report.
      expect(burgerBox.width).toBeGreaterThanOrEqual(40);
      expect(logoBox.width).toBeGreaterThanOrEqual(24);
      // Every bar child stays inside the viewport (the badge cluster wraps
      // instead of pushing anything out), and the page does not scroll
      // sideways.
      for (const child of children) {
        expect(child.right, child.testid).toBeLessThanOrEqual(width + 1);
        expect(child.left, child.testid).toBeGreaterThanOrEqual(-1);
      }
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });

    test("badges show only the count on the phone, the full label stays accessible", async ({
      page,
    }) => {
      const ready = await gotoDashboardWithDueReviews(page);
      test.skip(!ready, "bundled set has no matching exercise to seed due reviews");

      const badge = page.getByTestId("nav-reviews-badge");
      const count = await page.getByTestId("nav-reviews-badge-count").innerText();
      expect(count).toMatch(/^\d+$/);
      // innerText honours display:none, so the rendered badge is the bare
      // number while the accessible name still carries the word.
      expect((await badge.innerText()).trim()).toBe(count);
      expect(await badge.getAttribute("aria-label")).toContain(count);
      expect((await badge.getAttribute("aria-label"))!.length).toBeGreaterThan(count.length);
    });
  });
}
