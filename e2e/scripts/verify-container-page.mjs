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
    [/^(Lesson|AdaptiveLesson|EndlessLesson|ShuffleLesson|ErrorReplayLesson|Review|ImportDetail|SetDeepLink|LearningRepo)-/,
        "param route needs a real set/import row - covered by dexie-smoke + vitest"],
    [/^exercises-/, "exercise renderers load inside a running lesson - needs a set"],
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
    page.on("requestfailed", (req) =>
        problems.push(
            `[${currentRoute}] requestfailed: ${req.url().slice(0, 120)} (${req.failure()?.errorText ?? ""})`,
        ),
    );
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
    const visit = async (path) => {
        currentRoute = path;
        await page.goto(base + path, {waitUntil: "load", timeout: 30_000});
        await settle();
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
    await page.getByTestId("landing-lang-de").click({timeout: 5000}).catch(() => {});
    await settle();

    // 2. Onboarding fast path -> a real user, so the learner routes render
    //    their content (and load their lazy bundles) instead of redirecting.
    await visit("/onboarding");
    await page.getByTestId("migration-start-fresh").click({timeout: 3000}).catch(() => {});
    await page.getByTestId("onboarding-name").fill("Chain Probe");
    await page.getByTestId("onboarding-topic").fill("Spanish");
    await click("onboarding-submit");
    await click("onboarding-invite-start-now");
    await page.getByTestId("dashboard").waitFor({state: "visible", timeout: 20_000});
    for (const tab of ["activity", "missions", "overview"]) {
        await page.getByTestId(`dashboard-tab-${tab}`).click({timeout: 5000}).catch(() => {});
        await settle();
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
    await page.getByTestId("learning-path-view-map").click({timeout: 5000}).catch(() => {});
    await settle();
    await visit("/session");
    await visit("/progress");
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
