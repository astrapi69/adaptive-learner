/**
 * Skip-to-content link — focused state is visible AND readable (#1723).
 *
 * Regression pin: the #146/#194 content-link rule
 * ``a:not([data-slot="button"]):not(.btn)`` carried specificity (0,2,1)
 * (the ``:not()`` arguments count), beating ``.skip-to-content``'s
 * ``color: var(--accent-fg)`` at (0,1,0) — the focused pill painted its
 * label accent-on-accent (invisible). This spec asserts the REAL
 * computed colors, so any future specificity/cascade change that makes
 * the label unreadable again fails loudly.
 */

import { expect, test } from "@playwright/test";
import { completeOnboarding } from "../helpers";

test.describe("Skip-to-content — focused state (#1723)", () => {
  test("focused link is on-screen, compact, and its label color differs from the background", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-hub")).toBeVisible({
      timeout: 15000,
    });

    await page.keyboard.press("Tab");
    const link = page.getByTestId("skip-to-content");
    await expect(link).toBeFocused();
    // Let the top-transition settle before measuring.
    await page.waitForTimeout(300);

    const box = await link.boundingBox();
    expect(box, "focused skip link must have a layout box").toBeTruthy();
    // On-screen top-left, compact (not a full-width banner).
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.width).toBeLessThan(400);
    expect(box!.height).toBeLessThan(60);

    const { color, background, label } = await link.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        color: cs.color,
        background: cs.backgroundColor,
        label: (el.textContent ?? "").trim(),
      };
    });
    expect(label.length, "skip link must carry a label").toBeGreaterThan(0);
    // The core #1723 assertion: label color must NOT equal the pill fill.
    expect(color, "label color must differ from the background").not.toBe(
      background,
    );
  });
});
