/**
 * The app must WORK on its main routes, not merely respond (#2197, #2205).
 *
 * v2.8.0's white page shipped through green status-code proxies; the
 * unsafe-eval break (#2205) then hid on ANOTHER route, inside a
 * lazy-loaded bundle behind a Suspense boundary - opening the page and
 * seeing the shell would still have passed. So this check (a) walks the
 * MAIN ROUTES and enters the states that load the lazy bundles, (b)
 * treats every console error / blocked resource / failed request as a
 * failure, and (c) proves WHICH lazy chunks it loaded against the full
 * chunk list of the build - an unloaded new chunk fails the run until a
 * route covers it or it is excused here WITH a reason (shrink-only).
 *
 * Five-point contract: RED against the broken images (white page: 36
 * problems; eval: /content trips), green on a clean build, fails closed
 * (timeout/unreachable/no chunk list), prints routes visited + chunks
 * loaded/total (zero of either is never green), and asserts the same
 * things on every runner.
 *
 * Usage: node verify-container-page.mjs <base-url> [chunk-list-file]
 *   chunk-list-file: newline-separated basenames of dist/assets/*.js
 *   (e.g. from `docker exec <c> ls /app/static/assets`). Without it the
 *   chunk-coverage assertion FAILS CLOSED (cannot prove coverage).
 */
import {readFileSync} from "node:fs";

import {chromium} from "@playwright/test";

const base = process.argv[2];
const chunkListFile = process.argv[3];
if (!base) {
    console.error("usage: node verify-container-page.mjs <base-url> [chunk-list-file]");
    process.exit(2);
}

// Chunks legitimately not reachable from the walked routes. Every entry
// carries its reason; the list may only SHRINK. A new chunk not covered
// by a route lands in the failure list, never silently here.
const EXCUSED_UNLOADED = [
    [/^workbox-/, "service-worker runtime, fetched by the SW itself"],
    // Locale bundles load per selected language; the walk exercises the
    // default + one explicit switch (the landing language buttons), the
    // remaining languages are the same code path by construction.
    [/^[a-z-]+\.[a-z]{2,3}-/, "per-locale i18n bundle (one language exercised in the walk)"],
    [/^(ar|de|el|en|es|fr|hi|id|ja|ko|pt|tr|zh)-[A-Za-z0-9_-]{8}\.js$/, "per-locale i18n bundle (one language exercised in the walk)"],
    // Deep-feature chunks that need real user assets the bare container
    // cannot have; each is covered by its own suite (vitest/dexie-smoke)
    // and stays listed HERE so a rename/new sibling surfaces:
    [/^sql-wasm/, "sql.js loads on choosing an APKG/DB file in /import - needs a file"],
    [/^sse-reader-/, "streams only during a live AI session - needs a provider key"],
    [/^hljs-/, "code highlighting loads with lesson content containing code"],
    [/^(renderer|render-context|load-context-dexie)-/, "lesson player needs a downloaded set; dexie context needs browser-storage mode"],
    [/^vendor-tree-/, "tree widget loads with curriculum editing state"],
    // Param routes that need a real row/set the bare container cannot
    // have (lesson players, review, import detail, set deep link,
    // learning repo): each is covered by dexie-smoke / vitest suites.
    [/^(Lesson|AdaptiveLesson|EndlessLesson|ShuffleLesson|ErrorReplayLesson|Review|ImportDetail|SetDeepLink|LearningRepo|SetSummary)-/,
        "param route needs a real set/import row - covered by dexie-smoke + vitest"],
    [/^set-review-/,
        "set-completion aggregator shared by SetSummary and the lesson summary's Detailed evaluation (#3134) - both need a real set (#3155)"],
    [/^exercises-/, "exercise renderers load inside a running lesson - needs a set"],
    // The LessonRunner shell refactors (#3169) split the runner internals
    // into two shared chunks named after one member each: the summary's
    // ReviewedFallbackPanel (shared by RunnerStep + LessonStepView) and
    // hooks/lesson/sources. Both load only inside a running lesson; found
    // by the first weekly dry run (#3159, run 36610482730).
    [/^(ReviewedFallbackPanel|sources)-/,
        "lesson-runner shell internals load inside a running lesson - needs a set; covered by dexie-smoke + vitest"],
    [/^(RedeemInvite|QRScannerModal|ErrorReportDialog)-/,
        "loads on user action (invite link, QR scan, error report dialog)"],
    [/^apkg-builder-/, "loads on Anki .apkg export click - needs cards"],
    [/^LearningPathGraph-/, "graph view is feature-flagged off (#900)"],
];

// Documented-benign responses on a FRESH install (shrink-only, reasons
// in place): /api/identity 404s when no identity.yaml exists yet.
const EXPECTED_404 = [
    // fresh install: no identity yet
    /\/api\/identity$/,
    // skip-assessment onboarding path: no assessment profile exists;
    // the UI renders the empty radar for exactly this state
    /\/api\/plugins\/assessment\/profile\/[0-9a-f-]+$/,
];

const problems = [];
let expected404Hits = 0;
let abortedByNavigation = 0;
const loadedChunks = new Set();
let routesVisited = 0;

const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    let currentRoute = "(startup)";
    page.on("console", (msg) => {
        if (msg.type() === "error")
            problems.push(`[${currentRoute}] console.error: ${msg.text().slice(0, 180)}`);
    });
    page.on("pageerror", (err) =>
        problems.push(`[${currentRoute}] pageerror: ${String(err).slice(0, 180)}`),
    );
    page.on("requestfailed", (req) => {
        const reason = req.failure()?.errorText ?? "";
        // net::ERR_ABORTED is the browser cancelling its own request when
        // the walk navigates on - not a failed fetch. The second weekly
        // dry run (#3159, run 36614983886) tripped on a content-repo
        // search-index.json still in flight when /content?tab=my was
        // left. Every other reason (DNS, refused, reset, blocked) stays
        // a failure; a real network problem never reports as ABORTED.
        if (reason === "net::ERR_ABORTED") {
            abortedByNavigation += 1;
            return;
        }
        problems.push(`[${currentRoute}] requestfailed: ${req.url().slice(0, 120)} (${reason})`);
    });
    page.on("response", (resp) => {
        const url = resp.url();
        const chunk = url.match(/\/assets\/([^/?]+\.js)$/);
        if (chunk && resp.status() === 200) loadedChunks.add(chunk[1]);
        if (resp.status() < 400) return;
        if (resp.status() === 404 && EXPECTED_404.some((re) => re.test(url))) {
            expected404Hits += 1;
            return;
        }
        problems.push(`[${currentRoute}] http ${resp.status()}: ${url.slice(0, 140)}`);
    });

    const settle = () => page.waitForTimeout(1200);
    // Let a route's own fetches (content-repo indices, plugin manifests)
    // finish before the walk moves on, so their responses are judged
    // above instead of being cut off by the next navigation. Capped: a
    // route that never goes idle is not a finding here (the abort below
    // is then ignored, the response gate stays).
    const quiesce = () =>
        page.waitForLoadState("networkidle", {timeout: 5000}).catch(() => {});
    const visit = async (path) => {
        currentRoute = path;
        await page.goto(base + path, {waitUntil: "load", timeout: 30_000});
        await settle();
        await quiesce();
        const nodes = await page.evaluate(() => document.querySelectorAll("*").length);
        if (nodes < 20) problems.push(`[${path}] barely a DOM (${nodes} nodes)`);
        routesVisited += 1;
        console.log(`visited ${path} (${nodes} nodes)`);
    };
    const click = async (testid) => {
        currentRoute += ` >${testid}`;
        await page.getByTestId(testid).first().click({timeout: 10_000});
        await settle();
    };

    // 1. Empty install: landing appears; exercise one explicit language
    //    switch so the per-locale bundle path runs at least once.
    await visit("/");
    await page.getByTestId("landing").waitFor({state: "visible", timeout: 20_000});
    console.log("landing visible: the app APPEARS");
    // #3319: the switch is part of the landing (Landing.tsx renders it
    // unconditionally), so a missing button is a finding, not a skip.
    await click("landing-lang-de");

    // 2. Onboarding fast path -> a real user, so the learner routes render
    //    their content (and load their lazy bundles) instead of redirecting.
    await visit("/onboarding");
    // #3319 (the #3226 shape): the page states its migration verdict in
    // data-migration-offer ("pending" until its empty-install probe
    // settled). A bare container IS the case #1085 exists for: a fresh
    // local (API-mode) install with no data, so the page offers to bring
    // data over from the online version. The verdict must be "shown" and
    // the welcome must render (#3545: #3334 asserted the opposite). A
    // "none" means the offer is gone from the one place it belongs, a
    // missing verdict that the page never settled. The walk then dismisses
    // the welcome the way a learner without online data does.
    const onboardingRoot = page.getByTestId("onboarding");
    await onboardingRoot
        .waitFor({state: "visible", timeout: 20_000})
        .catch(() => problems.push("[/onboarding] the onboarding page never rendered"));
    await page
        .locator('[data-testid="onboarding"]:not([data-migration-offer="pending"])')
        .waitFor({state: "attached", timeout: 20_000})
        .catch(() => problems.push("[/onboarding] the migration verdict never settled"));
    const migrationOffer = await onboardingRoot
        .getAttribute("data-migration-offer")
        .catch(() => null);
    console.log(`onboarding migration verdict: ${migrationOffer}`);
    if (migrationOffer !== "shown") {
        problems.push(
            `[/onboarding] migration verdict is ${JSON.stringify(migrationOffer)}, expected "shown" on a bare container (#1085)`,
        );
    }
    const startFresh = page.getByTestId("migration-start-fresh");
    if ((await startFresh.count()) !== 1) {
        problems.push("[/onboarding] the migration welcome did not render on a bare container (#1085)");
    } else {
        await click("migration-start-fresh");
        if ((await startFresh.count()) !== 0) {
            problems.push("[/onboarding] the migration welcome stayed open after 'start fresh'");
        }
    }
    await page.getByTestId("onboarding-name").fill("Chain Probe");
    await page.getByTestId("onboarding-topic").fill("Spanish");
    await click("onboarding-submit");
    await click("onboarding-invite-start-now");
    await page.getByTestId("dashboard").waitFor({state: "visible", timeout: 20_000});
    // #3319: the three tabs are DASHBOARD_TAB_ORDER (Dashboard.tsx), always
    // rendered; each click loads that tab's lazy content, so a tab that is
    // gone would silently shrink the chunk coverage.
    for (const tab of ["activity", "missions", "overview"]) {
        await click(`dashboard-tab-${tab}`);
    }
    console.log("onboarded: dashboard visible");

    // 3. Main routes, entering the lazy states.
    await visit("/assessment");
    await visit("/curriculum");
    await visit("/statistics");
    await visit("/add-repo");
    await visit("/content");
    await visit("/content?tab=my"); // #2205: the analysis-to-lesson bundle
    await visit("/content?tab=browse");
    await visit("/learning-path");
    // #3319: the view switch renders in every personal-path state
    // (LearningPathPersonal passes it into each view), so the map click is
    // loud too; it is what loads the LearningPathMap chunk.
    await click("learning-path-view-map");
    await visit("/session");
    await visit("/progress");
    await visit("/arcade");
    for (const tab of ["general", "learning", "ai", "plugins", "data", "integrations", "help", "about"]) {
        await visit(`/settings?tab=${tab}`);
    }
    await visit("/import");
    await visit("/anki");
    await visit("/create-lesson");
    await visit("/pronunciation");
} catch (err) {
    problems.push(`[fatal] ${String(err).slice(0, 300)}`);
} finally {
    await browser.close();
}

// Chunk coverage: prove WHICH lazy bundles ran (the #2205 gap).
if (!chunkListFile) {
    problems.push("no chunk-list file given - chunk coverage cannot be proven (fail closed)");
} else {
    const all = readFileSync(chunkListFile, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.endsWith(".js"))
        .map((l) => {
            const m = l.match(/^(\d+)\s+(.*\.js)$/);
            return m ? {size: Number(m[1]), name: m[2]} : {size: null, name: l};
        });
    if (all.length === 0) problems.push("chunk list is empty - coverage proves nothing");
    const unloaded = all.map((e) => e.name).filter((name) => !loadedChunks.has(name));
    // Micro-chunks under 2500 bytes are tree-shaken single-icon/helper
    // modules, not feature code; they load with whichever feature uses
    // them. Counted and printed, never silently dropped. Requires sizes
    // in the chunk list ("<bytes> <name>" lines) - names-only lists keep
    // the strict behaviour (fail closed towards strictness).
    const micro = new Set(
        all.filter((e) => e.size !== null && e.size < 2500).map((e) => e.name),
    );
    const unexcused = unloaded.filter(
        (name) =>
            !micro.has(name) &&
            !EXCUSED_UNLOADED.some(([re]) => re.test(name)),
    );
    console.log(
        `chunk coverage: ${loadedChunks.size}/${all.length} loaded, ` +
            `${unloaded.length - unexcused.length} excused/micro, ${unexcused.length} uncovered`,
    );
    for (const name of unexcused)
        problems.push(`lazy chunk never loaded by any walked route: ${name}`);
}
if (routesVisited === 0) problems.push("zero routes visited - nothing was proven");
console.log(`routes visited: ${routesVisited}`);
console.log(`requests aborted by the walk's own navigation (ignored): ${abortedByNavigation}`);

// Drop exactly as many generic resource-load console errors as expected
// 404s occurred (the browser logs those fetches itself).
for (let dropped = 0; dropped < expected404Hits; dropped += 1) {
    const idx = problems.findIndex((p) => p.includes("console.error: Failed to load resource"));
    if (idx === -1) break;
    problems.splice(idx, 1);
}

if (problems.length) {
    console.error(`\nPAGE VERIFICATION FAILED (${problems.length} problem(s)):`);
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
}
console.log("page verification OK: routes render, lazy bundles covered, console clean");
