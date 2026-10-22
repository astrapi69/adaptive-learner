/**
 * The Pages build's own Content-Security-Policy and referrer policy (#3803).
 *
 * GitHub Pages sends no security headers, so ``index.html`` (and the
 * ``404.html`` copy of it that answers every deep link) carries them as
 * meta tags. They are defence in depth behind the renderers: Markdown, the
 * rich-text editor and the resource cards already load no image from
 * another host, and this policy makes the browser refuse one should a
 * renderer regress. API mode sends the same ``img-src`` and ``media-src``
 * as a header (``backend/app/frontend_static.py``).
 *
 * The policy names ``img-src`` and ``media-src`` only. Everything else
 * stays unrestricted on purpose: the learner's AI provider and GitHub
 * content are fetched by design (``connect-src``), and the service worker
 * and the inline theme script need no exception.
 *
 * ``index.html`` is listed in ``forceRerunTriggers`` (vite.config.ts), so
 * the selective PR runner re-runs this file when index.html changes.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const INDEX_HTML = readFileSync(join(__dirname, "..", "..", "index.html"), "utf-8");

/** Every source an image or a media element may load from, with the reason. */
const ALLOWED_SOURCES: [source: string, reason: string][] = [
    ["'self'", "the app's own files (icons, badges, avatars, fonts)"],
    ["data:", "embedded images, generated QR codes and uploaded audio clips"],
    ["blob:", "downloaded set assets, which useAsset hands out as object URLs, and recordings"],
    ["https://raw.githubusercontent.com", "files of the content repositories, e.g. book covers"],
];

const CSP_META = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?>/gi;
const REFERRER_META = /<meta\s+name="referrer"\s+content="([^"]*)"\s*\/?>/gi;

/** The ``content`` of every meta tag ``tag`` matches. */
function metaContents(tag: RegExp): string[] {
    return [...INDEX_HTML.matchAll(tag)].map((match) => match[1]);
}

/** A policy as directive name -> sources. */
function directives(policy: string): Map<string, string[]> {
    const parsed = new Map<string, string[]>();
    for (const part of policy.split(";")) {
        const [name, ...sources] = part.trim().split(/\s+/);
        if (name) parsed.set(name, sources);
    }
    return parsed;
}

const policies = metaContents(CSP_META);
const policy = directives(policies[0] ?? "");

describe("index.html Content-Security-Policy (#3803)", () => {
    it("reproduction: carries exactly one policy", () => {
        expect(policies).toHaveLength(1);
    });

    it.each(["img-src", "media-src"])("limits %s to the allowed sources", (directive) => {
        expect(policy.get(directive)).toEqual(ALLOWED_SOURCES.map(([source]) => source));
    });

    it.each(ALLOWED_SOURCES)("allows %s for images, because of %s", (source) => {
        expect(policy.get("img-src")).toContain(source);
    });

    it("restricts nothing else, so AI providers, GitHub content and the service worker keep working", () => {
        expect([...policy.keys()]).toEqual(["img-src", "media-src"]);
    });

    it("comes before anything the page loads, or it would not govern it", () => {
        const policyAt = INDEX_HTML.search(/<meta\s+http-equiv="Content-Security-Policy"/i);
        const firstLoad = INDEX_HTML.search(/<link\s|<script[\s>]/i);
        expect(policyAt).toBeGreaterThan(-1);
        expect(policyAt).toBeLessThan(firstLoad);
    });
});

describe("index.html referrer policy (#3803)", () => {
    it("sends no Referer to any host, like the API mode's header", () => {
        expect(metaContents(REFERRER_META)).toEqual(["no-referrer"]);
    });
});
