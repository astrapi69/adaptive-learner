/**
 * Helpers for the visual-regression suite (#244, infra block 8).
 *
 * Two concerns:
 *   1. ``setTheme`` — pin a theme BEFORE first paint via the real
 *      localStorage key (``adaptive-learner.theme``), so the index.html
 *      pre-paint script applies it with no flash.
 *   2. Per-view seeding + navigation — bring each of the 5 critical views
 *      into a deterministic, screenshot-worthy state in the dexie build
 *      (no backend), reusing the onboarding + lesson-playthrough patterns
 *      the dexie smoke specs already rely on.
 *
 * THEME_IDS mirrors ``frontend/src/lib/themes.ts`` ``THEME_IDS`` exactly
 * (verified against the registry, not guessed). If a theme is added /
 * renamed there, update this list (a future enhancement could generate it).
 */

import {expect, type Page} from "@playwright/test";

import {completeAssessment, completeOnboarding} from "../helpers";

/** All 12 registered themes (6 recommended + 6 classic). */
export const THEME_IDS = [
    "catppuccin-latte",
    "supabase",
    "graphite",
    "catppuccin-mocha",
    "soft-pop",
    "amethyst-haze",
    "light",
    "dark",
    "ocean",
    "forest",
    "high-contrast",
    "sepia",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

/** The 5 critical views screenshotted across every theme. */
export const VIEW_NAMES = [
    "dashboard",
    "learning-path",
    "lesson-matching",
    "lesson-result",
    "settings",
] as const;

export type ViewName = (typeof VIEW_NAMES)[number];

/** A bundled set guaranteed present in the GH-Pages build. */
const SET_ID = "fr-a1-from-en";

/**
 * Pin the theme before any navigation. ``addInitScript`` runs before page
 * scripts on EVERY navigation in this context, so the pre-paint script
 * (and React's useTheme) read the chosen theme from the first load on.
 */
export async function setTheme(page: Page, theme: ThemeId): Promise<void> {
    await page.addInitScript((value) => {
        try {
            localStorage.setItem("adaptive-learner.theme", value);
        } catch {
            /* localStorage blocked — the default theme still renders. */
        }
    }, theme);
}

/** Seed a learner (onboarding quick-start + assessment) -> lands on /dashboard. */
async function seedLearner(page: Page): Promise<void> {
    await completeOnboarding(page);
    await completeAssessment(page);
    await page.waitForURL("**/dashboard", {timeout: 30_000});
}

/**
 * Download the bundled set and play its first lesson. ``stopAt`` controls
 * where the playthrough halts:
 *   - "summary": answer every step, land on the lesson summary.
 *   - "matching-result": pair the FIRST matching exercise with one
 *     deliberate wrong pair, check it (showing correct + wrong feedback),
 *     and stop there.
 * Returns true if the requested state was reached, false otherwise (so the
 * caller can skip rather than commit a meaningless baseline).
 */
async function playBundledLesson(
    page: Page,
    stopAt: "summary" | "matching-result",
): Promise<boolean> {
    await page.goto("/content");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 20_000});
    await page.getByTestId("content-other-toggle").click();
    await page.getByTestId(`content-set-${SET_ID}-action`).click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({timeout: 25_000});
    await openBtn.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 20_000});

    for (let i = 0; i < 60; i++) {
        if (await page.getByTestId("lesson-summary").count()) break;

        const isMatching = (await page.getByTestId("matching-exercise").count()) > 0;
        if (isMatching && stopAt === "matching-result") {
            const reached = await pairMatchingWithOneWrong(page);
            if (reached) return true;
        }

        await answerCurrentStep(page);

        const check = page.getByTestId("lesson-check");
        if (await check.count()) {
            await expect(check).toBeEnabled({timeout: 5_000});
            await check.click();
        }
        const next = page.getByTestId("lesson-next");
        if (await next.count()) {
            await expect(next).toBeVisible({timeout: 5_000});
            await next.click();
            await page.waitForTimeout(80);
        }
    }

    if (stopAt === "summary") {
        await expect(page.getByTestId("lesson-summary")).toBeVisible({
            timeout: 20_000,
        });
        return true;
    }
    // Requested a matching result but never hit a matching step.
    return false;
}

/** Answer whatever exercise the current step renders (any valid answer). */
async function answerCurrentStep(page: Page): Promise<void> {
    if (await page.getByTestId("free-text-input").count()) {
        await page.getByTestId("free-text-input").fill("Bonjour");
    } else if (await page.getByTestId("word-tiles-exercise").count()) {
        const tiles = page.locator('[data-testid^="word-tile-scrambled-"]');
        let guard = 0;
        while ((await tiles.count()) > 0 && guard++ < 12) {
            await tiles.first().click();
        }
    } else if (await page.getByTestId("picture-exercise").count()) {
        await page.locator('[data-testid^="picture-choice-"]').first().click();
    } else if (await page.getByTestId("matching-exercise").count()) {
        const lefts = page.getByTestId(/^matching-left-\d+$/);
        const n = await lefts.count();
        for (let j = 0; j < n; j++) {
            await page.getByTestId(`matching-left-${j}`).click();
            await page.getByTestId(`matching-right-${j}`).click();
        }
    } else {
        const blanks = page.locator('[data-testid^="cloze-input-"]');
        const n = await blanks.count();
        for (let j = 0; j < n; j++) await blanks.nth(j).fill("Bonjour");
    }
}

/**
 * Pair a matching exercise so that at least one pair is WRONG and one is
 * correct, then check — leaving the post-submit feedback (green + red) on
 * screen. Returns false when the grid is too small to make a mixed result.
 */
async function pairMatchingWithOneWrong(page: Page): Promise<boolean> {
    const lefts = page.getByTestId(/^matching-left-\d+$/);
    const n = await lefts.count();
    if (n < 2) return false;
    // First left -> a non-matching right (wrong); the rest -> their own
    // index (correct), so the result shows both states.
    await page.getByTestId("matching-left-0").click();
    await page.getByTestId("matching-right-1").click();
    await page.getByTestId("matching-left-1").click();
    await page.getByTestId("matching-right-0").click();
    for (let j = 2; j < n; j++) {
        await page.getByTestId(`matching-left-${j}`).click();
        await page.getByTestId(`matching-right-${j}`).click();
    }
    const submit = page.getByTestId("matching-submit");
    await expect(submit).toBeEnabled({timeout: 5_000});
    await submit.click();
    await expect(page.getByTestId("matching-result")).toBeVisible({
        timeout: 5_000,
    });
    return true;
}

/**
 * Bring ``view`` into its screenshot state (theme already pinned by the
 * caller). Returns true when ready, false when the view could not be
 * deterministically reached (caller skips).
 */
export async function gotoView(page: Page, view: ViewName): Promise<boolean> {
    switch (view) {
        case "settings":
            await seedLearner(page);
            await page.goto("/settings");
            await expect(page.getByTestId("settings")).toBeVisible({
                timeout: 20_000,
            });
            return true;
        case "dashboard":
            await seedLearner(page);
            // A played lesson populates XP / progress / missions.
            await playBundledLesson(page, "summary");
            await page.goto("/dashboard");
            await expect(page.getByTestId("dashboard")).toBeVisible({
                timeout: 20_000,
            });
            return true;
        case "learning-path":
            await seedLearner(page);
            await playBundledLesson(page, "summary");
            await page.goto("/learning-path");
            await expect(page.getByTestId("learning-path-page")).toBeVisible({
                timeout: 20_000,
            });
            return true;
        case "lesson-result":
            return playBundledLesson(page, "summary");
        case "lesson-matching":
            return playBundledLesson(page, "matching-result");
        default:
            return false;
    }
}
