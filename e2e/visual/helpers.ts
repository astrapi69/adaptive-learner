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

/** Frozen wall-clock for every visual run (follows #244). Relative times
 *  ("vor 3 Minuten", streak dates, "Morgen neue Missionen") would otherwise
 *  drift day-to-day and make the screenshots flaky. */
const FIXED_NOW_ISO = "2026-06-10T14:00:00Z";

/**
 * Freeze ``Date`` to a fixed instant before any page script runs, so every
 * relative-time / timestamp render is deterministic. Added before the first
 * navigation (``addInitScript`` re-applies on each navigation in the context).
 */
export async function freezeClock(page: Page): Promise<void> {
    await page.addInitScript((iso) => {
        const fixedMs = new Date(iso).getTime();
        const OriginalDate = Date;
        class FrozenDate extends OriginalDate {
            constructor(...args: ConstructorParameters<typeof Date>) {
                if (args.length === 0) {
                    super(fixedMs);
                } else {
                    // @ts-expect-error — forward the original Date overloads.
                    super(...args);
                }
            }
            static now() {
                return fixedMs;
            }
        }
        globalThis.Date = FrozenDate as DateConstructor;
    }, FIXED_NOW_ISO);
}

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

/**
 * Settle the page for a deterministic screenshot: wait for web fonts, kill
 * any animation/transition durations, and allow one reflow after the
 * font-swap (the gap between fallback and loaded font is a flake source).
 */
export async function settleForScreenshot(page: Page): Promise<void> {
    await page.addStyleTag({
        content:
            "*, *::before, *::after { animation-duration: 0s !important;" +
            " animation-delay: 0s !important; transition-duration: 0s !important;" +
            " transition-delay: 0s !important; caret-color: transparent !important; }",
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);
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
/**
 * Download the bundled set (if not already cached) and open its first
 * lesson, leaving the page on the lesson runner (``lesson-page`` visible).
 * Shared opener for every lesson-state seed.
 */
async function openFirstBundledLesson(page: Page): Promise<void> {
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 20_000});
    await page.getByTestId("content-other-toggle").click();
    await page.getByTestId(`content-set-${SET_ID}-action`).click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({timeout: 25_000});
    await openBtn.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 20_000});
}

async function playBundledLesson(
    page: Page,
    stopAt: "summary" | "matching-result",
): Promise<boolean> {
    await openFirstBundledLesson(page);

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
 *
 * Inside a lesson the MatchingExercise is rendered ``controlled`` (see
 * ``Lesson.tsx``), so its internal ``matching-submit`` button is NOT
 * rendered — submission is driven by the shared external ``lesson-check``
 * button (``exerciseRef.submit()`` -> ``setSubmitted(true)``), which then
 * renders ``matching-result``. Issue #270.
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
    const submit = page.getByTestId("lesson-check");
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
            // Wait for the set rows (content loaded), not just the page shell
            // (which also renders during loading/empty) — a stable ready signal.
            await expect(page.getByTestId("learning-path-sets")).toBeVisible({
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

/* ------------------------------------------------------------------ *
 * Critical-surfaces matrix (#705) — surfaces × viewports, default theme.
 *
 * Phase 1 of #705: broaden the #244 theme matrix (which is 5 views ×
 * desktop) into the critical user-facing surfaces, each shot at three
 * responsive viewports so layout regressions (overflow, stacked nav,
 * touch targets) are caught alongside the theme/contrast ones.
 * ------------------------------------------------------------------ */

/** The three responsive breakpoints every critical surface is shot at. */
export const VIEWPORTS = {
    desktop: {width: 1920, height: 1080},
    tablet: {width: 768, height: 1024},
    mobile: {width: 375, height: 667},
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

/** Every critical surface in the Phase-1 (default-theme) matrix. */
export const SURFACE_NAMES = [
    "dashboard-empty",
    "dashboard-populated",
    "content-browser",
    "set-detail",
    "lesson-theory",
    "lesson-cloze",
    "lesson-matching",
    "lesson-summary",
    "review-session",
    "statistics",
    "settings-general",
    "settings-data",
    "settings-about",
    "shortcut-help",
] as const;

export type SurfaceName = (typeof SURFACE_NAMES)[number];

/**
 * Advance the open lesson runner until ``predicate`` reports the wanted
 * step is on screen, answering each intervening step. Returns true when
 * the predicate matched, false if the lesson ended first (so the caller
 * can skip rather than commit a meaningless baseline).
 */
async function advanceLessonUntil(
    page: Page,
    predicate: () => Promise<boolean>,
): Promise<boolean> {
    for (let i = 0; i < 60; i++) {
        if (await predicate()) return true;
        if (await page.getByTestId("lesson-summary").count()) return false;
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
    return false;
}

/** Open the bundled lesson and stop on the first ``lesson-theory`` step. */
async function gotoLessonTheory(page: Page): Promise<boolean> {
    await openFirstBundledLesson(page);
    const theory = page.getByTestId("lesson-theory");
    if (await theory.count()) {
        await expect(theory.first()).toBeVisible({timeout: 10_000});
        return true;
    }
    return advanceLessonUntil(
        page,
        async () => (await page.getByTestId("lesson-theory").count()) > 0,
    );
}

/** Open the bundled lesson and stop on the first ``cloze-exercise`` step. */
async function gotoLessonCloze(page: Page): Promise<boolean> {
    await openFirstBundledLesson(page);
    const reached = await advanceLessonUntil(
        page,
        async () => (await page.getByTestId("cloze-exercise").count()) > 0,
    );
    if (reached) {
        await expect(page.getByTestId("cloze-exercise").first()).toBeVisible({
            timeout: 10_000,
        });
    }
    return reached;
}

/** Open the bundled lesson and stop on the unsolved ``matching-exercise``. */
async function gotoLessonMatching(page: Page): Promise<boolean> {
    await openFirstBundledLesson(page);
    const reached = await advanceLessonUntil(
        page,
        async () => (await page.getByTestId("matching-exercise").count()) > 0,
    );
    if (reached) {
        await expect(page.getByTestId("matching-exercise").first()).toBeVisible({
            timeout: 10_000,
        });
    }
    return reached;
}

/**
 * Seed a learner, then drive a wrong-answer matching playthrough (which
 * writes ``ElementError`` rows) and open the set's review session.
 * Falls back to whatever review state renders (active / empty) — both are
 * valid, deterministic screenshots; only an unreachable page is skipped.
 */
async function gotoReviewSession(page: Page): Promise<boolean> {
    await seedLearner(page);
    await playBundledLesson(page, "matching-result");
    await page.goto(`/review/${SET_ID}`);
    const surface = page
        .getByTestId("review-page")
        .or(page.getByTestId("review-empty"));
    try {
        await expect(surface.first()).toBeVisible({timeout: 20_000});
        return true;
    } catch {
        return false;
    }
}

/**
 * Bring ``surface`` into its screenshot state in the DEFAULT theme. The
 * caller has already set the viewport + frozen the clock. Returns true
 * when ready, false when the surface can't be reached deterministically
 * (caller skips).
 */
export async function gotoSurface(
    page: Page,
    surface: SurfaceName,
): Promise<boolean> {
    switch (surface) {
        case "dashboard-empty":
            await seedLearner(page);
            await page.goto("/dashboard");
            await expect(page.getByTestId("dashboard")).toBeVisible({
                timeout: 20_000,
            });
            return true;
        case "dashboard-populated":
            await seedLearner(page);
            await playBundledLesson(page, "summary");
            await page.goto("/dashboard");
            await expect(page.getByTestId("dashboard")).toBeVisible({
                timeout: 20_000,
            });
            return true;
        case "content-browser":
            await seedLearner(page);
            await page.goto("/content?tab=my");
            await expect(page.getByTestId("content-tree")).toBeVisible({
                timeout: 20_000,
            });
            return true;
        case "set-detail":
            await seedLearner(page);
            await page.goto("/content?tab=my");
            await expect(page.getByTestId("content-tree")).toBeVisible({
                timeout: 20_000,
            });
            await page.getByTestId("content-other-toggle").click();
            await page.getByTestId(`content-set-${SET_ID}-action`).click();
            // The downloaded set exposes its Open control once cached — a
            // stable signal that the set-detail surface has rendered.
            await expect(page.getByTestId(`content-set-${SET_ID}-open`)).toBeVisible(
                {timeout: 25_000},
            );
            return true;
        case "lesson-theory":
            await seedLearner(page);
            return gotoLessonTheory(page);
        case "lesson-cloze":
            await seedLearner(page);
            return gotoLessonCloze(page);
        case "lesson-matching":
            await seedLearner(page);
            return gotoLessonMatching(page);
        case "lesson-summary":
            await seedLearner(page);
            return playBundledLesson(page, "summary");
        case "review-session":
            return gotoReviewSession(page);
        case "statistics":
            await seedLearner(page);
            await playBundledLesson(page, "summary");
            await page.goto("/statistics");
            await expect(page.getByTestId("statistics")).toBeVisible({
                timeout: 20_000,
            });
            return true;
        case "settings-general":
            await seedLearner(page);
            await page.goto("/settings?tab=general");
            await expect(page.getByTestId("settings")).toBeVisible({
                timeout: 20_000,
            });
            return true;
        case "settings-data":
            await seedLearner(page);
            await page.goto("/settings?tab=data");
            await expect(page.getByTestId("settings")).toBeVisible({
                timeout: 20_000,
            });
            return true;
        case "settings-about":
            await seedLearner(page);
            await page.goto("/settings?tab=about");
            await expect(page.getByTestId("settings")).toBeVisible({
                timeout: 20_000,
            });
            return true;
        case "shortcut-help":
            await seedLearner(page);
            await page.goto("/dashboard");
            await expect(page.getByTestId("dashboard")).toBeVisible({
                timeout: 20_000,
            });
            await page.keyboard.press("?");
            await expect(page.getByTestId("shortcut-help")).toBeVisible({
                timeout: 10_000,
            });
            return true;
        default:
            return false;
    }
}
