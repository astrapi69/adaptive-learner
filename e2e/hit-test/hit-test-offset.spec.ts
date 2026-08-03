/**
 * Hit-test offset characterisation harness (#1569).
 *
 * The tap/click-lands-below bug is a desync between where a target is RENDERED
 * and the coordinate the browser HIT-TESTS. This suite measures that desync in
 * real Chromium against an isolated shell fixture, one row per factor
 * combination, so:
 *
 *   - any scenario that reproduces the desync turns RED with the measured pixel
 *     offset and the wrong element it resolved to — a reproducible target to fix
 *     against, adjustable without touching the whole app;
 *   - the same suite is the regression net once a fix lands (the offsets must
 *     stay 0);
 *   - a scenario that stays GREEN in headless documents that THAT factor does
 *     not, by itself, produce a CSSOM-vs-hit-test disagreement here — narrowing
 *     the search (and pointing at the device-only visual-viewport class the
 *     ?vvdiag=1 probe measures on hardware).
 *
 * The measurement that DOES surface in headless: for a target, does
 * ``document.elementFromPoint(rect-centre)`` return that same target, and does a
 * real ``mouse.click`` at that centre activate it? boundingBox() and mouse.click
 * share the layout coordinate space, so they only disagree when a transform /
 * compositing layer offsets the hit-test grid from the CSSOM box — exactly the
 * class a desktop-Chrome repro would be.
 *
 * ADJUST: add or edit rows in SCENARIOS. Each is one factor combination; the
 * fixture's query toggles are documented in fixtures/shell.html.
 */

import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const FIXTURE = pathToFileURL(
  path.join(__dirname, "fixtures", "shell.html"),
).href;

interface Scenario {
  name: string;
  /** Fixture query toggles (shell/headerTransform/ancestorTransform/sticky/zoomMeta/scroll). */
  query: string;
  viewport: { width: number; height: number };
  /** Which target index to aim at (0-based). */
  target: number;
}

// ── ADJUST HERE ──────────────────────────────────────────────────────────────
const SCENARIOS: Scenario[] = [
  { name: "baseline — natural document flow", query: "n=30", viewport: { width: 390, height: 844 }, target: 10 },
  { name: "app shell (overflow-hidden + 100dvh + inner scroller)", query: "shell=1&n=30", viewport: { width: 390, height: 844 }, target: 10 },
  { name: "shell + sticky header transform", query: "shell=1&headerTransform=1&n=30", viewport: { width: 390, height: 844 }, target: 12 },
  { name: "shell + ancestor transform over targets", query: "shell=1&ancestorTransform=1&n=30", viewport: { width: 390, height: 844 }, target: 12 },
  { name: "shell + sticky footer", query: "shell=1&sticky=1&n=30", viewport: { width: 390, height: 844 }, target: 16 },
  { name: "shell + all aggravators + zoom meta", query: "shell=1&headerTransform=1&ancestorTransform=1&sticky=1&zoomMeta=1&n=30", viewport: { width: 390, height: 844 }, target: 12 },
  { name: "shell + pre-scroll 200px", query: "shell=1&scroll=200&n=40", viewport: { width: 390, height: 844 }, target: 14 },
  { name: "shell + ancestor transform + pre-scroll 200px", query: "shell=1&ancestorTransform=1&scroll=200&n=40", viewport: { width: 390, height: 844 }, target: 14 },
];
// ─────────────────────────────────────────────────────────────────────────────

for (const sc of SCENARIOS) {
  test(`hit-test offset — ${sc.name}`, async ({ page }) => {
    await page.setViewportSize(sc.viewport);
    await page.goto(`${FIXTURE}?${sc.query}`);
    const target = page.getByTestId(`target-${sc.target}`);
    await target.scrollIntoViewIfNeeded();

    // Reset any earlier hit, then measure the target's rendered centre.
    await page.evaluate(() => {
      (window as unknown as { __lastHit: number | null }).__lastHit = null;
    });
    const box = await target.boundingBox();
    expect(box, `target-${sc.target} must be laid out`).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // What does the browser HIT-TEST at that visual centre?
    const resolved = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        const testid = el?.dataset?.testid ?? null;
        const idx = testid?.startsWith("target-")
          ? Number(testid.slice("target-".length))
          : null;
        return { testid: testid ?? el?.tagName ?? null, idx };
      },
      [cx, cy],
    );

    // And which handler does a real click at that centre fire?
    await page.mouse.click(cx, cy);
    const hit = await page.evaluate(
      () => (window as unknown as { __lastHit: number | null }).__lastHit,
    );

    const rowsOff = resolved.idx == null ? "n/a" : resolved.idx - sc.target;
    // eslint-disable-next-line no-console
    console.log(
      `[${sc.name}] aim target-${sc.target} @(${cx.toFixed(0)},${cy.toFixed(0)}) ` +
        `-> elementFromPoint=${resolved.testid} (Δrows=${rowsOff}) click.hit=${hit}`,
    );

    expect(
      resolved.idx,
      `elementFromPoint at target-${sc.target}'s rendered centre must be target-${sc.target} (Δrows=${rowsOff})`,
    ).toBe(sc.target);
    expect(
      hit,
      `a click at target-${sc.target}'s rendered centre must activate it, not target-${hit}`,
    ).toBe(sc.target);
  });
}
