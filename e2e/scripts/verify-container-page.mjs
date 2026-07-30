/**
 * The page must APPEAR, not merely respond (#2197).
 *
 * Every earlier chain station proved proxies: health JSON, a 200 on "/",
 * script tags in the HTML. None ever executed a page. This check starts a
 * real Chromium against the running container and demands CAPABILITY:
 * a known element visible, zero console errors, zero blocked resources.
 *
 * Five-point contract:
 * - detects the violation: RED against the v2.8.0 image (white page, CSP);
 * - passes on a clean build;
 * - fails CLOSED on timeout / unreachable target / browser missing;
 * - proves it actually loaded a page (URL, title, DOM node count printed -
 *   a run without a loaded page cannot read as green);
 * - the verdict does not depend on where it runs (headless chromium,
 *   same assertions everywhere).
 *
 * Usage: node verify-container-page.mjs http://127.0.0.1:18711
 */
import {chromium} from "@playwright/test";

const base = process.argv[2];
if (!base) {
    console.error("usage: node verify-container-page.mjs <base-url>");
    process.exit(2);
}

const problems = [];
// Documented-benign responses on a FRESH install, each justified here and
// matched EXACTLY - this list may only shrink. /api/identity 404s when no
// identity.yaml exists yet (the post-wipe recovery probe finding nothing to
// recover); the browser still logs the fetch as a console error.
const EXPECTED_404 = [/\/api\/identity$/];
let expected404Hits = 0;
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    page.on("console", (msg) => {
        if (msg.type() === "error") problems.push(`console.error: ${msg.text().slice(0, 200)}`);
    });
    page.on("pageerror", (err) => problems.push(`pageerror: ${String(err).slice(0, 200)}`));
    page.on("response", (resp) => {
        if (resp.status() < 400) return;
        if (resp.status() === 404 && EXPECTED_404.some((re) => re.test(resp.url()))) {
            expected404Hits += 1;
            return;
        }
        problems.push(`http ${resp.status()}: ${resp.url().slice(0, 140)}`);
    });
    page.on("requestfailed", (req) => {
        const failure = req.failure()?.errorText ?? "";
        problems.push(`requestfailed: ${req.url().slice(0, 120)} (${failure})`);
    });

    await page.goto(base + "/", {waitUntil: "load", timeout: 30_000});
    // Proof of a loaded page - a run that loaded nothing must not be green.
    const nodes = await page.evaluate(() => document.querySelectorAll("*").length);
    const title = await page.title();
    console.log(`loaded: ${page.url()} | title: ${JSON.stringify(title)} | DOM nodes: ${nodes}`);
    if (nodes < 20) problems.push(`page barely has a DOM (${nodes} nodes) - nothing rendered`);

    // Empty install: the SPA must show the landing page. Visible = capability.
    try {
        await page.getByTestId("landing").waitFor({state: "visible", timeout: 20_000});
        console.log("landing visible: the app APPEARS");
    } catch {
        problems.push("known element [data-testid=landing] never became visible - white page class");
    }
} catch (err) {
    problems.push(`load failed: ${String(err).slice(0, 300)}`);
} finally {
    await browser.close();
}

// Drop exactly as many generic resource-load console errors as expected
// 404s occurred - the browser logs those fetches itself and offers no way
// to tie the log line to its request.
for (let dropped = 0; dropped < expected404Hits; dropped += 1) {
    const idx = problems.findIndex((p) => p.startsWith("console.error: Failed to load resource"));
    if (idx === -1) break;
    problems.splice(idx, 1);
}

if (problems.length) {
    console.error(`\nPAGE VERIFICATION FAILED (${problems.length} problem(s)):`);
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
}
console.log("page verification OK: rendered, interactive element visible, console clean");
