/**
 * Shared hit-test measurement for the #1569 harness.
 *
 * For an element, scroll it to the viewport centre (mirroring the user reaching
 * for it, and moving it clear of any sticky header/footer), then check that
 * ``document.elementFromPoint`` at its rendered centre resolves back INTO the
 * same element's subtree. A mismatch is the render-vs-hit-test desync; ``deltaY``
 * quantifies the vertical gap to whatever the browser hit-tested instead.
 *
 * Non-destructive: it never clicks, so it is safe to sweep many real
 * interactive elements on a route without mutating app state.
 */

import type { Locator } from "@playwright/test";

export interface HitCheck {
  label: string;
  cx: number;
  cy: number;
  /** elementFromPoint(centre) is the element itself or within its subtree. */
  ok: boolean;
  resolvedTag: string | null;
  resolvedTestid: string | null;
  /** Rendered top of the wrongly-resolved element minus the centre Y. */
  deltaY: number | null;
}

export async function checkHitTest(
  locator: Locator,
  label: string,
): Promise<HitCheck | null> {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  if (!box || box.width === 0 || box.height === 0) return null;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return await locator.evaluate(
    (el, args) => {
      const { cx, cy, label } = args as { cx: number; cy: number; label: string };
      // Unmeasurable points are SKIPPED (return null), never counted as a
      // desync — a false positive is worse than no measurement. Two cases:
      //   - the rendered centre is outside the visual viewport (an off-screen
      //     skip-link, or an element taller than the viewport whose midpoint
      //     scrolls past an edge);
      //   - elementFromPoint finds nothing there (viewport edge / detached).
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (cx < 0 || cy < 0 || cx >= vw || cy >= vh) return null;
      const hit = document.elementFromPoint(cx, cy);
      if (!hit) return null;
      const ok = el === hit || el.contains(hit) || hit.contains(el);
      return {
        label,
        cx: Math.round(cx),
        cy: Math.round(cy),
        ok,
        resolvedTag: ok ? null : hit.tagName.toLowerCase(),
        resolvedTestid: ok ? null : hit.getAttribute("data-testid"),
        deltaY: ok ? null : Math.round(hit.getBoundingClientRect().top - cy),
      };
    },
    { cx, cy, label },
  );
}
