/**
 * Schrittwechsel auf dem Telefon: der neue Schritt liegt oben, die
 * Fusszeile unten (#3126).
 *
 * Auf dem iPhone blieb nach "Weiter" von einem langen auf einen kurzen
 * Schritt die untere Bildschirmhälfte leer: zwei konkurrierende Scrolls
 * (Reset auf ``#root`` und ein weiches ``scrollIntoView``) liefen aus einem
 * Offset heraus, den die geschrumpfte Scroll-Höhe nicht mehr hatte. Chromium
 * reproduziert den iOS-Klemm-Fehler nicht; dieser Spec pinnt den Vertrag,
 * den der Fix herstellt: nach dem Wechsel sitzt der Schrittanker am oberen
 * Rand des Scroll-Containers, der Offset liegt innerhalb der neuen
 * Scroll-Höhe, und die sticky Fusszeile liegt innerhalb des Viewports.
 */

import { expect, test } from "@playwright/test";

import { answerCurrentStep, openFirstBundledLesson } from "../visual/helpers";

test.describe("Lesson step re-anchor on a phone (#3126)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("after Next the step anchor is at the top and the footer inside the viewport", async ({
    page,
  }) => {
    await openFirstBundledLesson(page);
    await expect(page.getByTestId("lesson-next")).toBeVisible({ timeout: 20_000 });

    // Scroll the first step to the very bottom, so the offset is as far from
    // the top as this step allows (a long step on a real device).
    await page.evaluate(() => {
      const root = document.getElementById("root")!;
      root.scrollTop = root.scrollHeight;
    });
    const before = await page.evaluate(() => document.getElementById("root")!.scrollTop);

    // Advance one step (answer + check when the step needs it).
    await answerCurrentStep(page);
    const check = page.getByTestId("lesson-check");
    if (await check.count()) {
      await expect(check).toBeEnabled({ timeout: 5_000 });
      await check.click();
    }
    const next = page.getByTestId("lesson-next");
    await expect(next).toBeVisible({ timeout: 5_000 });
    await next.click();

    // Let the ordered re-anchor (reset, then anchor after two frames plus
    // the smooth scroll) settle: the anchor sits at the scrollport top.
    await page.waitForFunction(
      () => {
        const root = document.getElementById("root")!;
        const anchor = document.querySelector<HTMLElement>(".scroll-mt-4");
        if (!anchor) return false;
        const top = anchor.getBoundingClientRect().top - root.getBoundingClientRect().top;
        return top >= -1 && top <= 32;
      },
      undefined,
      { timeout: 5_000 },
    );
    const after = await page.evaluate(() => {
      const root = document.getElementById("root")!;
      const anchor = document.querySelector<HTMLElement>(".scroll-mt-4")!;
      const footer = document.querySelector<HTMLElement>('[data-testid="lesson-footer"]');
      const footerBox = footer?.getBoundingClientRect();
      return {
        scrollTop: root.scrollTop,
        anchorTop: anchor.getBoundingClientRect().top - root.getBoundingClientRect().top,
        scrollHeight: root.scrollHeight,
        clientHeight: root.clientHeight,
        footerBottom: footerBox ? Math.round(footerBox.bottom) : null,
        footerTop: footerBox ? Math.round(footerBox.top) : null,
      };
    });
    console.log(`[#3126] before=${before} after=${JSON.stringify(after)}`);

    // The offset never exceeds what the new layout can scroll (no stale
    // offset from the previous, taller step).
    expect(after.scrollTop).toBeLessThanOrEqual(after.scrollHeight - after.clientHeight + 1);
    // The anchor sits at the top of the scrollport (scroll-mt-4 = 16px gap,
    // measured 23px after the smooth scroll settles; 32px keeps headroom).
    expect(after.anchorTop).toBeGreaterThanOrEqual(-1);
    expect(after.anchorTop).toBeLessThanOrEqual(32);
    // The sticky footer is inside the viewport, not hanging mid-screen
    // above an empty half.
    if (after.footerBottom !== null) {
      expect(after.footerBottom).toBeLessThanOrEqual(667 + 1);
      expect(after.footerTop!).toBeGreaterThan(200);
    }
  });
});
