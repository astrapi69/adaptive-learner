/**
 * Content-obtainability probe (#2043) - runs BEFORE the dexie-smoke
 * project (Playwright ``dependencies``).
 *
 * A build/environment where the content specs cannot obtain any content
 * used to fail as ~34 individually red specs with generic
 * ``toBeVisible()`` messages that said nothing about the cause; the
 * attribution loop cost a full session (#2043). Two earlier explanations
 * (missing ``dist/content`` bundle; missing browser network) were both
 * DISPROVED by measurement - CI runs green with no bundle, and a later
 * sandbox reached raw.githubusercontent.com from the browser. So this
 * probe does not guess a discriminator: it measures the actual
 * precondition through the app's own mechanism (``DEFAULT_SOURCES`` in
 * ``content-loader-sources.ts``: bundled tree first, then the upstream
 * repo raw URL) FROM THE BROWSER, and fails once, loudly, with the full
 * channel diagnostics - the recording the issue asks every future
 * occurrence to produce.
 *
 * CI-invariant: when either channel delivers a manifest, the probe
 * passes and every spec runs exactly as before. When neither delivers,
 * the run is RED (this probe fails; the dependent project is skipped) -
 * never a green run with hidden coverage.
 */

import {expect, test} from "@playwright/test";

/** The two DEFAULT_SOURCES channels, as the browser sees them. */
const BUNDLED_MANIFEST = "content/adaptive-learner-content/manifest.yaml";
const UPSTREAM_MANIFEST =
    "https://raw.githubusercontent.com/astrapi69/adaptive-learner-content/main/manifest.yaml";

interface ChannelResult {
    url: string;
    ok: boolean;
    status: number | null;
    bytes: number;
    error: string | null;
}

test("content is obtainable through at least one DEFAULT_SOURCES channel", async ({
    page,
    baseURL,
}, testInfo) => {
    // RED self-test hook (gate contract point 1): with
    // ``CONTENT_PROBE_SIMULATE_UNOBTAINABLE=1`` both channels are
    // aborted at the network layer, reproducing the incident state so
    // the probe's failure path stays provable on demand.
    if (process.env.CONTENT_PROBE_SIMULATE_UNOBTAINABLE === "1") {
        await page.route("**/content/adaptive-learner-content/**", (route) =>
            route.abort(),
        );
        await page.route("**raw.githubusercontent.com**", (route) =>
            route.abort(),
        );
    }
    await page.goto("/");
    const channels: ChannelResult[] = await page.evaluate(
        async (urls: string[]) => {
            const results = [];
            for (const url of urls) {
                try {
                    const response = await fetch(url, {cache: "no-store"});
                    const body = await response.text();
                    results.push({
                        url,
                        ok: response.ok && body.length > 0,
                        status: response.status,
                        bytes: body.length,
                        error: null,
                    });
                } catch (err) {
                    results.push({
                        url,
                        ok: false,
                        status: null,
                        bytes: 0,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }
            return results;
        },
        [new URL(BUNDLED_MANIFEST, `${baseURL}/`).toString(), UPSTREAM_MANIFEST],
    );

    testInfo.annotations.push({
        type: "measurement",
        description: channels
            .map(
                (c) =>
                    `${c.url} -> ok=${c.ok} status=${c.status} bytes=${c.bytes}` +
                    (c.error ? ` error=${c.error}` : ""),
            )
            .join(" | "),
    });

    const obtainable = channels.some((c) => c.ok);
    expect(
        obtainable,
        [
            "No content channel delivered a manifest - every content-dependent",
            "spec in the dexie-smoke project would fail with vague locator",
            "timeouts, so the run stops HERE with the cause instead (#2043).",
            "",
            ...channels.map(
                (c) =>
                    `  ${c.url}\n    ok=${c.ok} status=${c.status} bytes=${c.bytes}` +
                    (c.error ? ` error=${c.error}` : ""),
            ),
            "",
            "Remedies:",
            "  - bundled channel: check out adaptive-learner-content next to",
            "    this repo (or set ADAPTIVE_LEARNER_CONTENT_DIR) and rebuild",
            "    with VITE_STORAGE_MODE=dexie, OR",
            "  - runtime channel: give the browser network access to",
            "    raw.githubusercontent.com.",
        ].join("\n"),
    ).toBe(true);
});
