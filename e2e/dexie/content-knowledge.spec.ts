/**
 * Content Browser — "Wissen" (non-language knowledge) grouping
 * (E2E hardening). Dexie build, NO backend.
 *
 * Complements content-tree.spec.ts (which covers the language
 * "Sprachen" tree). The bundled library ships non-language sets
 * (psychology + programming, where source == target). The browser
 * must split those into a separate "Wissen" section grouped by
 * domain. This also downloads a knowledge set and opens its first
 * lesson to prove the non-language end-to-end path renders.
 *
 * STABLE SELECTORS ONLY (Phase-B-proof): ``data-testid`` anchors. No
 * CSS-class or DOM-structure assertions.
 */

import {expect, test} from "@playwright/test";

const KNOWLEDGE_SET = "psych-intro-from-de";

test.describe("Content Browser — Wissen (knowledge) section", () => {
    test("knowledge sets group under Wissen, separate from the language tree", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto("/content");

        // The language tree renders...
        await expect(page.getByTestId("content-tree")).toBeVisible({
            timeout: 15000,
        });
        // ...and the non-language "Wissen" section is a separate group.
        await expect(page.getByTestId("content-knowledge")).toBeVisible();
        // Domain sub-group (psychology) + its set row.
        await expect(
            page.getByTestId("content-domain-psychology"),
        ).toBeVisible();
        await expect(
            page.getByTestId(`content-set-${KNOWLEDGE_SET}`),
        ).toBeVisible();

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("download a knowledge set and open its first lesson", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto("/content");
        await expect(page.getByTestId("content-knowledge")).toBeVisible({
            timeout: 15000,
        });

        // Download (idempotent) then open -> the lesson viewer renders a
        // non-language (source == target) lesson.
        await page.getByTestId(`content-set-${KNOWLEDGE_SET}-action`).click();
        const openBtn = page.getByTestId(`content-set-${KNOWLEDGE_SET}-open`);
        await expect(openBtn).toBeVisible({timeout: 20000});
        await openBtn.click();
        await expect(page.getByTestId("lesson-page")).toBeVisible({
            timeout: 15000,
        });

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
