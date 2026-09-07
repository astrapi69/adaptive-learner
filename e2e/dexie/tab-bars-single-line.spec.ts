/**
 * Reiterleisten auf schmalen Geräten (#3012).
 *
 * Der bestehende Gate ``no-horizontal-scroll.spec.ts`` misst ÜBERLAUF, nicht
 * Brauchbarkeit: eine Leiste, die ihre Reiter in eine zweite Zeile schiebt
 * oder sie staucht, erzeugt keinen Überlauf und ist für ihn dasselbe wie eine
 * saubere einzeilige Leiste. Genau deshalb blieb unbemerkt, dass die
 * Inhalte-Leiste bei 375px und darunter umbrach: es sah nach Absicht aus.
 *
 * Dieser Spec misst, was der andere nicht sieht:
 *   1. die Leiste ist einzeilig (alle Reiter auf derselben Höhe), und
 *   2. kein Reiter ist schmaler als sein Inhalt (nicht gestaucht).
 *
 * Er meldet zusätzlich die gemessenen Breiten, damit ein Fehlschlag sofort
 * sagt, wie viel fehlt, statt nur "war zweizeilig" (Gate-Vertrag #2083
 * Punkt 4: sagen, was gemessen wurde).
 */

import { expect, test, type Page } from "@playwright/test";
import { createTestUser } from "../helpers/onboarding";

/** Phone widths. 320px is the narrowest supported; 390/414 are current iPhones. */
const WIDTHS = [320, 375, 390, 414];

interface BarSpec {
  name: string;
  path: string;
  testId: string;
  /** Needs onboarding first (the route redirects otherwise). */
  auth: boolean;
  /** Widths where a wrap is accepted and why. Everything else must be one line. */
  wrapAllowedAt?: number[];
}

const BARS: readonly BarSpec[] = [
  { name: "Inhalte", path: "/content", testId: "content-hub-tabs", auth: false },
  { name: "Fortschritt", path: "/progress", testId: "progress-hub-tabs", auth: true },
  { name: "Dashboard", path: "/dashboard", testId: "dashboard-tabs", auth: true },
];

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

interface BarReading {
  rows: number;
  squeezed: string[];
  need: number;
  inner: number;
  labels: string[];
}

async function readBar(page: Page, testId: string): Promise<BarReading> {
  return page.evaluate((tid) => {
    const bar = document.querySelector(`[data-testid='${tid}']`);
    if (!bar) throw new Error(`tab bar ${tid} not found`);
    const cs = getComputedStyle(bar);
    const gap = parseFloat(cs.gap) || 0;
    const inner =
      bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const tabs = [...bar.querySelectorAll("[role='tab']")];
    const boxes = tabs.map((t) => {
      const r = t.getBoundingClientRect();
      // scrollWidth < rendered width means the label had to be squeezed.
      return {
        label: (t.textContent ?? "").trim(),
        w: r.width,
        y: Math.round(r.top),
        squeezed: r.width + 1 < t.scrollWidth,
      };
    });
    return {
      rows: new Set(boxes.map((b) => b.y)).size,
      squeezed: boxes.filter((b) => b.squeezed).map((b) => b.label),
      need: +(boxes.reduce((a, b) => a + b.w, 0) + gap * (boxes.length - 1)).toFixed(1),
      inner: +inner.toFixed(1),
      labels: boxes.map((b) => b.label),
    };
  }, testId);
}

function assertBar(bar: BarSpec, width: number, r: BarReading): void {
  const detail =
    `${bar.name} @${width}px: ${r.labels.length} Reiter (${r.labels.join(", ")}), ` +
    `brauchen ${r.need}px, verfügbar ${r.inner}px`;
  // Fail closed: a bar with no tabs would otherwise pass every assertion.
  expect(r.labels.length, `${detail} — keine Reiter gefunden`).toBeGreaterThan(1);
  expect(r.squeezed, `${detail} — gestauchte Beschriftungen`).toEqual([]);
  if (bar.wrapAllowedAt?.includes(width)) return;
  expect(r.rows, `${detail} — Leiste ist nicht einzeilig`).toBe(1);
}

test.describe("Reiterleisten bleiben auf Telefonen einzeilig (#3012)", () => {
  for (const width of WIDTHS) {
    test(`öffentliche Leisten @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      for (const bar of BARS.filter((b) => !b.auth)) {
        await page.goto(bar.path);
        await page.locator(`[data-testid='${bar.testId}']`).waitFor({ timeout: 15000 });
        await settleLayout(page);
        assertBar(bar, width, await readBar(page, bar.testId));
      }
    });
  }

  for (const width of WIDTHS) {
    test(`angemeldete Leisten @ ${width}px`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width, height: 720 });
      await createTestUser(page);
      for (const bar of BARS.filter((b) => b.auth)) {
        await page.goto(bar.path);
        await page.locator(`[data-testid='${bar.testId}']`).waitFor({ timeout: 15000 });
        await settleLayout(page);
        assertBar(bar, width, await readBar(page, bar.testId));
      }
    });
  }
});
