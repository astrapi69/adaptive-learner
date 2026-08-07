/**
 * robots.txt and the app sitemap stay aligned with reality (#2405).
 *
 * The docs sitemap (480 URLs, the only mass-crawlable surface) was
 * never announced by the root robots.txt, and the hand-kept app
 * sitemap listed /content - an address that 301s into the SPA shell
 * and does not exist as a page. These pins keep both fixed: robots
 * announces BOTH sitemaps, and the app sitemap lists no dead /content
 * entry. readFileSync-based (#1620 caveat: full/nightly is the net).
 */

import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public");
const robots = readFileSync(join(publicDir, "robots.txt"), "utf-8");
const sitemap = readFileSync(join(publicDir, "sitemap.xml"), "utf-8");

describe("public SEO alignment (#2405)", () => {
    it("robots.txt announces the app AND the docs sitemap", () => {
        expect(robots).toContain(
            "Sitemap: https://astrapi69.github.io/adaptive-learner/sitemap.xml",
        );
        expect(robots).toContain(
            "Sitemap: https://astrapi69.github.io/adaptive-learner/docs/sitemap.xml",
        );
    });

    it("the app sitemap lists no dead /content entry", () => {
        expect(sitemap).not.toContain("/adaptive-learner/content</loc>");
    });

    it("every sitemap entry is a real static page of the delivery", () => {
        const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
        const allowed = [
            "https://astrapi69.github.io/adaptive-learner/",
            "https://astrapi69.github.io/adaptive-learner/start/",
            "https://astrapi69.github.io/adaptive-learner/start/en/",
        ];
        expect(locs).toEqual(allowed);
    });
});
