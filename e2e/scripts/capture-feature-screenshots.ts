/**
 * Per-feature screenshot baselines (#1023).
 *
 * One labelled screenshot per *feature* (not per generic surface), captured at
 * the DEFAULT theme (``dark``) and TWO viewports — desktop ``1280×720`` and
 * mobile ``375×812`` — into ``e2e/visual/features/<feature>/<shot>.png`` and
 * ``…/<shot>.mobile.png``. These baselines serve double duty: pixel-diff
 * regression AND a documentation gallery of every visual feature.
 *
 * The {@link FEATURES} map is the single source of truth: each entry pairs a
 * screenshot ``path`` (``<feature-folder>/<shot>`` — kebab-case, no extension)
 * with a ``setup`` that drives the dexie preview build (no backend) into the
 * state to capture. ``setup`` returns ``false`` when the state can't be reached
 * deterministically (e.g. the bundled set has no matching exercise), and the
 * test is skipped rather than committing a meaningless baseline.
 *
 * Generating / updating the baselines (maintainer, on a consistent machine —
 * font anti-aliasing differs between machines, so NOT in an ephemeral
 * CI/web container):
 *   1. ``make capture-screenshots``  (builds the dexie frontend, then
 *      ``--update-snapshots``)
 *   2. REVIEW every PNG under ``e2e/visual/features/`` before committing.
 *      NEVER ``--update-snapshots`` to silence a diff that reveals a real bug —
 *      fix the bug.
 *
 * Verifying:
 *   ``make verify-screenshots``  (pixel-compares against the committed PNGs)
 *
 * Some product features are NOT web-reachable by Playwright and are captured
 * manually (documented in ``e2e/visual/features/README.md``): the desktop
 * **launcher** (a native PyInstaller/Docker GUI, not a web route).
 */

import {expect, test, type Page} from "@playwright/test";

import {
    advanceLessonUntil,
    freezeClock,
    openFirstBundledLesson,
    seedLearner,
    setTheme,
    settleForScreenshot,
} from "../visual/helpers";

/** The default theme every feature baseline is captured at (spec: dark). */
const DEFAULT_THEME = "dark" as const;

/** Desktop + mobile capture sizes (spec: 1280×720 + 375×812). */
const VIEWPORTS = [
    {key: "desktop", size: {width: 1280, height: 720}, suffix: ""},
    {key: "mobile", size: {width: 375, height: 812}, suffix: ".mobile"},
] as const;

/** One capturable feature state. */
interface FeatureShot {
    /** ``<feature-folder>/<shot>`` — kebab-case, no extension, no viewport
     *  suffix. Becomes ``e2e/visual/features/<feature-folder>/<shot>.png``. */
    path: string;
    /** Bring the page into the screenshot state. ``false`` => skip (no baseline). */
    setup: (page: Page) => Promise<boolean>;
    /** Capture desktop only (e.g. a desktop-anchored dialog). Default: both. */
    desktopOnly?: boolean;
}

/** Open ``/content`` on a given tab and wait for the hub shell. */
async function gotoContentTab(page: Page, tab: "discover" | "my" | "import") {
    await seedLearner(page);
    const suffix = tab === "discover" ? "" : `?tab=${tab}`;
    await page.goto(`/content${suffix}`);
    await expect(page.getByTestId("content-hub")).toBeVisible({timeout: 20_000});
    return true;
}

/** Open ``/dashboard`` on a given tab and wait for the page shell. */
async function gotoDashboardTab(
    page: Page,
    tab: "overview" | "activity" | "missions",
) {
    await seedLearner(page);
    const suffix = tab === "overview" ? "" : `?tab=${tab}`;
    await page.goto(`/dashboard${suffix}`);
    await expect(page.getByTestId("dashboard")).toBeVisible({timeout: 20_000});
    await expect(page.getByTestId(`dashboard-tab-${tab}-panel`)).toBeVisible({
        timeout: 20_000,
    });
    return true;
}

/** Open ``/progress`` on a given tab and wait for the hub shell. */
async function gotoProgressTab(
    page: Page,
    tab: "overview" | "stats" | "paths",
) {
    await seedLearner(page);
    const suffix = tab === "overview" ? "" : `?tab=${tab}`;
    await page.goto(`/progress${suffix}`);
    await expect(page.getByTestId("progress-hub")).toBeVisible({timeout: 20_000});
    return true;
}

/** Seed a learner and open the bundled lesson runner (theory step visible). */
async function gotoLessonRunner(page: Page): Promise<boolean> {
    await seedLearner(page);
    await openFirstBundledLesson(page);
    return true;
}

/**
 * Advance the open lesson to the first matching exercise (unsolved).
 * Returns false when the bundled lesson has no matching step.
 */
async function gotoLessonMatching(page: Page): Promise<boolean> {
    if (!(await gotoLessonRunner(page))) return false;
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
 * Advance the open matching exercise to its resolved (post-check) state with
 * one wrong + the rest correct, so the green/red feedback shows. Returns false
 * when there is no matching exercise.
 */
async function gotoLessonMatchingResolved(page: Page): Promise<boolean> {
    if (!(await gotoLessonMatching(page))) return false;
    const lefts = page.getByTestId(/^matching-left-\d+$/);
    const n = await lefts.count();
    if (n < 2) return false;
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
 * Drive a free-text exercise to a WRONG, submitted state so the
 * "Meine Antwort / Auflösung" answer toggle (#1004) is on screen, switched to
 * the requested side. Returns false when the lesson has no free-text step.
 */
async function gotoAnswerToggle(
    page: Page,
    side: "my-answer" | "solution",
): Promise<boolean> {
    if (!(await gotoLessonRunner(page))) return false;
    const reached = await advanceLessonUntil(
        page,
        async () => (await page.getByTestId("free-text-input").count()) > 0,
    );
    if (!reached) return false;
    await page.getByTestId("free-text-input").fill("definitely-wrong-answer");
    const check = page.getByTestId("lesson-check");
    await expect(check).toBeEnabled({timeout: 5_000});
    await check.click();
    const toggle = page.getByTestId("free-text-answer-toggle");
    if (!(await toggle.count())) return false;
    await expect(toggle).toBeVisible({timeout: 5_000});
    if (side === "solution") {
        await page.getByTestId("free-text-solution").click();
    } else {
        await page.getByTestId("free-text-my-answer").click();
    }
    return true;
}

/** Open the bundled lesson and reveal the practice/exam/timed mode toggle. */
async function gotoLessonModeToggle(
    page: Page,
    mode: "practice" | "exam" | "timed",
): Promise<boolean> {
    if (!(await gotoLessonRunner(page))) return false;
    const toggle = page.getByTestId("lesson-mode-toggle");
    if (!(await toggle.count())) return false;
    await expect(toggle).toBeVisible({timeout: 10_000});
    await page.getByTestId(`lesson-mode-${mode}`).click();
    return true;
}

/**
 * Open the GitHub repo-export dialog (#1009) on a downloaded set. Returns false
 * when the feature is gated off (no GitHub token in the dexie preview build) —
 * the share button is then absent, so there is nothing to capture.
 */
async function gotoGithubExport(page: Page): Promise<boolean> {
    await seedLearner(page);
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-hub")).toBeVisible({timeout: 20_000});
    const share = page.getByTestId(/-share-repo$/).first();
    if (!(await share.count())) return false;
    await share.click();
    const dialog = page.getByTestId("repo-export-name");
    if (!(await dialog.count())) return false;
    await expect(dialog).toBeVisible({timeout: 10_000});
    return true;
}

/** Open the QR-code "share the app" modal from the About tab (#775). */
async function gotoQrModal(page: Page): Promise<boolean> {
    await seedLearner(page);
    await page.goto("/settings?tab=about");
    await expect(page.getByTestId("settings")).toBeVisible({timeout: 20_000});
    const trigger = page.getByTestId("about-share-show-qr");
    if (!(await trigger.count())) return false;
    await trigger.click();
    const modal = page.getByTestId("qr-code-modal");
    if (!(await modal.count())) return false;
    await expect(modal).toBeVisible({timeout: 10_000});
    return true;
}

/**
 * Every per-feature baseline. Kebab-case ``<feature-folder>/<shot>`` paths;
 * the test loop appends the viewport suffix + ``.png``.
 */
const FEATURES: FeatureShot[] = [
    // --- Tabbed hubs -----------------------------------------------------
    {path: "dashboard-tabs/uebersicht", setup: (p) => gotoDashboardTab(p, "overview")},
    {path: "dashboard-tabs/aktivitaet", setup: (p) => gotoDashboardTab(p, "activity")},
    {path: "dashboard-tabs/missionen", setup: (p) => gotoDashboardTab(p, "missions")},
    {path: "content-hub/entdecken", setup: (p) => gotoContentTab(p, "discover")},
    {
        path: "content-hub/meine-inhalte",
        // Wait for the (async) set catalogue, not just the hub shell —
        // otherwise the shot captures the "Inhalte werden geladen…" state.
        // The default view is the LIST (#1257); an explicit "grid" pref
        // renders the tree instead, so accept either surface.
        setup: async (p) => {
            await gotoContentTab(p, "my");
            const catalogue = p
                .getByTestId("content-list-view")
                .or(p.getByTestId("content-tree"));
            try {
                await catalogue.first().waitFor({timeout: 20_000});
            } catch {
                return false;
            }
            return true;
        },
    },
    // #1386 — the status/source filter menu buttons (closed state is part of
    // the meine-inhalte shot above; this captures the OPEN status menu).
    {
        path: "content-hub/meine-inhalte-filter-open",
        setup: async (p) => {
            await gotoContentTab(p, "my");
            const trigger = p.getByTestId("content-status-filter");
            try {
                await trigger.waitFor({timeout: 20_000});
            } catch {
                return false;
            }
            await trigger.click();
            await expect(p.getByTestId("content-status-filter-menu")).toBeVisible({
                timeout: 10_000,
            });
            return true;
        },
    },
    // #1392 — the LIST view with the longest catalogue title
    // ("Portugiesisch (Brasilianisch) A1 (für Deutschsprachige)"): the
    // mobile shot pins that the title truncates and the language badge +
    // three-dot actions menu stay inside the viewport, flush-aligned.
    {
        path: "content-hub/meine-inhalte-liste-langtitel",
        setup: async (p) => {
            await gotoContentTab(p, "my");
            // The view toggle appears once the (async) set catalogue is in.
            const toggle = p.getByTestId("content-view-list");
            try {
                await toggle.waitFor({timeout: 20_000});
            } catch {
                return false;
            }
            await toggle.click();
            await expect(p.getByTestId("content-list-view")).toBeVisible({
                timeout: 10_000,
            });
            const longRow = p.getByTestId("content-list-set-pt-br-a1-from-de");
            try {
                await longRow.waitFor({timeout: 10_000});
            } catch {
                return false;
            }
            // #root is the app's scroll container (html/body are locked), so
            // a fullPage shot cannot reach below the fold — bring the
            // long-title row into the visible fold instead.
            await longRow.scrollIntoViewIfNeeded();
            return true;
        },
    },
    {path: "content-hub/import", setup: (p) => gotoContentTab(p, "import")},
    {path: "progress-hub/uebersicht", setup: (p) => gotoProgressTab(p, "overview")},
    {path: "progress-hub/statistik", setup: (p) => gotoProgressTab(p, "stats")},
    {path: "progress-hub/meine-pfade", setup: (p) => gotoProgressTab(p, "paths")},

    // --- Matching animation / resolution --------------------------------
    {path: "matching-animation/matching-pairing", setup: gotoLessonMatching},
    {path: "matching-animation/matching-resolved", setup: gotoLessonMatchingResolved},

    // --- Lesson modes (practice / exam / timed) -------------------------
    {path: "lesson-modes/practice", setup: (p) => gotoLessonModeToggle(p, "practice")},
    {path: "lesson-modes/exam", setup: (p) => gotoLessonModeToggle(p, "exam")},
    {path: "lesson-modes/timed", setup: (p) => gotoLessonModeToggle(p, "timed")},

    // --- Answer toggle (Meine Antwort / Auflösung) ----------------------
    {path: "answer-toggle/meine-antwort", setup: (p) => gotoAnswerToggle(p, "my-answer")},
    {path: "answer-toggle/aufloesung", setup: (p) => gotoAnswerToggle(p, "solution")},

    // --- GitHub export (desktop dialog) ---------------------------------
    {path: "github-export/share-dialog", setup: gotoGithubExport, desktopOnly: true},

    // --- QR-code app sharing --------------------------------------------
    {path: "qr-code/share-app", setup: gotoQrModal, desktopOnly: true},
];

for (const feature of FEATURES) {
    for (const vp of VIEWPORTS) {
        if (feature.desktopOnly && vp.key !== "desktop") continue;
        test(`${feature.path} @ ${vp.key}`, async ({page}) => {
            await page.setViewportSize(vp.size);
            // Determinism: freeze the clock + pin the default (dark) theme
            // before the first navigation, then seed the feature state, then
            // settle fonts + kill animations.
            await freezeClock(page);
            await setTheme(page, DEFAULT_THEME);
            const ready = await feature.setup(page);
            test.skip(!ready, `Could not reach ${feature.path} deterministically`);
            await settleForScreenshot(page);
            // Pass the snapshot name as an ARRAY of path segments, not a
            // string. Playwright sanitises a string name (``/`` and ``.``
            // both become ``-``), which would flatten
            // ``answer-toggle/aufloesung.mobile`` to a single
            // ``answer-toggle-aufloesung-mobile.png`` file at the features
            // root. For an array it does ``path.join(...name)`` with NO
            // sanitisation, so the baseline lands at the intended
            // ``features/<feature>/<shot>.png`` subdirectory the issue +
            // CONTRIBUTING require (#1023).
            const segments = feature.path.split("/");
            const file = `${segments.pop()}${vp.suffix}.png`;
            await expect(page).toHaveScreenshot([...segments, file], {
                fullPage: true,
            });
        });
    }
}
