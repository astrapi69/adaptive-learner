/**
 * Pins that no URL in ``index.html`` is RELATIVE (#2541).
 *
 * GitHub Pages has no server-side rewrite, so it answers every unmatched
 * path with ``404.html`` - a byte-identical copy of ``index.html``. The
 * same markup is therefore delivered under ``/dashboard``,
 * ``/review/es-a1`` and every other deep link, and a relative ``href``
 * resolves against THAT path instead of the site root:
 *
 *   served at /adaptive-learner/dashboard  ->  start/  becomes
 *   /adaptive-learner/dashboard/start/     ->  404
 *
 * The links this bit are the ``<noscript>`` pointers to the static landing
 * page (#2409), i.e. exactly the audience that cannot recover by clicking
 * around: visitors without JavaScript, and crawlers.
 *
 * Allowed forms: an absolute URL, a root-absolute path (Vite rewrites the
 * asset ones for ``base``), a ``%BASE_URL%``-templated path, a fragment,
 * or a data/mailto URI. Anything else is relative and breaks at depth.
 *
 * ``index.html`` is listed in ``forceRerunTriggers`` (vite.config.ts), so
 * the selective PR runner re-runs this file when index.html changes -
 * without that, a readFileSync pin like this one is invisible to it
 * (#1614 / #1620).
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const INDEX_HTML = join(__dirname, "..", "..", "index.html");

/** Every ``href=""`` / ``src=""`` value in the document, in order. */
export function extractUrls(html: string): string[] {
    return [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
}

/** True when a URL resolves independently of the path it is served at. */
export function isDepthSafe(url: string): boolean {
    return (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("//") ||
        url.startsWith("/") ||
        url.startsWith("%BASE_URL%") ||
        url.startsWith("#") ||
        url.startsWith("data:") ||
        url.startsWith("mailto:")
    );
}

describe("index.html URLs survive being served at any depth", () => {
    it("contains no relative href/src (404.html is served at every path)", () => {
        const urls = extractUrls(readFileSync(INDEX_HTML, "utf-8"));
        // Report WHAT was measured: an empty scan must not read as a clean one.
        expect(urls.length).toBeGreaterThan(5);
        expect(urls.filter((url) => !isDepthSafe(url))).toEqual([]);
    });

    it("still points at the static landing page in both languages", () => {
        const html = readFileSync(INDEX_HTML, "utf-8");
        expect(html).toContain('href="%BASE_URL%start/"');
        expect(html).toContain('href="%BASE_URL%start/en/"');
    });

    it("classifies the relative form this pin exists for as unsafe", () => {
        expect(isDepthSafe("start/")).toBe(false);
        expect(isDepthSafe("start/en/")).toBe(false);
        expect(isDepthSafe("%BASE_URL%start/")).toBe(true);
        expect(isDepthSafe("/favicon.ico")).toBe(true);
    });
});
