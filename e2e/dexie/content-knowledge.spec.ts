/**
 * Content Browser — "Wissen" (non-language knowledge) grouping
 * (E2E hardening). Dexie build, NO backend.
 *
 * Complements content-tree.spec.ts (which covers the language
 * "Sprachen" tree). The bundled library ships non-language sets
 * (the App-Tutorial, domain ``software``, where source == target).
 * The browser must split those into a separate "Wissen" section
 * grouped by domain. This also downloads a knowledge set and opens
 * its first lesson to prove the non-language end-to-end path renders.
 *
 * STABLE SELECTORS ONLY (Phase-B-proof): ``data-testid`` anchors. No
 * CSS-class or DOM-structure assertions.
 */

import {expect, test} from "@playwright/test";

// The bundled knowledge set is the App-Tutorial (domain ``software``,
// de -> de). The former psychology set was extracted from the content
// repo (main is now language + software only), so the "Wissen" section
// is exercised through the surviving software domain.
const KNOWLEDGE_SET = "adaptive-learner-app-from-de";
const KNOWLEDGE_DOMAIN = "software";

test.describe("Content Browser — Wissen (knowledge) section", () => {
    test("knowledge sets group under Wissen, separate from the language tree", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto("/content?tab=my");

        // The language tree renders...
        await expect(page.getByTestId("content-tree")).toBeVisible({
            timeout: 15000,
        });
        // ...and the non-language "Wissen" section is a separate group.
        await expect(page.getByTestId("content-knowledge")).toBeVisible();
        // Domain sub-group (software) + its set row.
        await expect(
            page.getByTestId(`content-domain-${KNOWLEDGE_DOMAIN}`),
        ).toBeVisible();
        await expect(
            page.getByTestId(`content-set-${KNOWLEDGE_SET}`),
        ).toBeVisible();

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("download a knowledge set and open its first lesson", async ({
        page,
    }) => {
        // Downloading a set caches every lesson into IndexedDB, which is
        // the slow step and can approach the default 30s per-test cap under
        // full-gate parallel load. Give this slow-by-nature test headroom.
        test.setTimeout(120_000);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto("/content?tab=my");
        await expect(page.getByTestId("content-knowledge")).toBeVisible({
            timeout: 15000,
        });

        // Download (idempotent) then open -> the lesson viewer renders a
        // non-language (source == target) lesson. Caching the set's
        // lessons into IndexedDB is the slow step and can tip past a 20s
        // wait under full-gate parallel load, so allow generous headroom
        // here (the download is the slow step; opening the cached first
        // lesson is fast).
        await page.getByTestId(`content-set-${KNOWLEDGE_SET}-action`).click();
        const openBtn = page.getByTestId(`content-set-${KNOWLEDGE_SET}-open`);
        await expect(openBtn).toBeVisible({timeout: 60000});
        await openBtn.click();
        await expect(page.getByTestId("lesson-page")).toBeVisible({
            timeout: 15000,
        });

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
