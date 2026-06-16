/**
 * Error collectors for the manual-automation suite (#616).
 *
 * Same contract as the dexie-smoke gate: capture uncaught page errors and
 * console errors, filtering the network noise that is expected in the
 * GH-Pages-shape build (a few legacy ``/api/...`` probes, SW chatter)
 * before the SW + Dexie path take over. The hard signal is a
 * user-visible error toast (asserted separately) + uncaught exceptions.
 */

import type { Page } from "@playwright/test";

export interface ErrorCollectors {
  pageErrors: () => string[];
  consoleErrors: () => string[];
}

/** Attach pageerror + console listeners; returns getters for assertions. */
export function installErrorCollectors(page: Page): ErrorCollectors {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (err) => {
    pageErrors.push(`${err.name}: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Expected Dexie-mode network noise — not a feature defect.
    if (text.includes("Failed to load resource")) return;
    if (text.includes("net::ERR_")) return;
    if (text.includes("Workbox")) return;
    consoleErrors.push(text);
  });

  return {
    pageErrors: () => pageErrors,
    consoleErrors: () => consoleErrors,
  };
}
