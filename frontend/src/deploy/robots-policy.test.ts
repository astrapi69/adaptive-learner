/**
 * Preview deployments must not be indexable (#2404, EXP-049).
 *
 * The preview delivery is a staging copy of production; it used to ship
 * the production `robots index, follow` meta plus an allow-all
 * robots.txt, so search engines could index it. These tests pin the
 * pure transformation half of the fix: every delivered HTML document
 * gets a noindex robots meta, and the emitted robots.txt disallows
 * everything. The wiring half (the Vite plugin rewriting dist/ when
 * VITE_ROBOTS_POLICY=noindex) is exercised through the plugin factory.
 */

import {describe, expect, it} from "vitest";

import {
    NOINDEX_ROBOTS_TXT,
    rewriteRobotsMeta,
    robotsPolicyPlugin,
} from "./robots-policy";

describe("rewriteRobotsMeta", () => {
    it("replaces an index,follow robots meta with noindex,nofollow", () => {
        const html = '<head><meta name="robots" content="index, follow"/></head>';
        const out = rewriteRobotsMeta(html);
        expect(out).toContain('name="robots"');
        expect(out).toContain("noindex, nofollow");
        expect(out).not.toContain("index, follow");
    });

    it("injects a robots meta into a head that has none", () => {
        const html = "<html><head><title>x</title></head><body></body></html>";
        const out = rewriteRobotsMeta(html);
        expect(out).toContain('<meta name="robots" content="noindex, nofollow"');
    });

    it("touches every robots meta, not only the first", () => {
        const html =
            '<head><meta name="robots" content="index, follow"/>' +
            '<meta name="robots" content="all"/></head>';
        const out = rewriteRobotsMeta(html);
        expect(out.match(/noindex, nofollow/g)?.length).toBe(2);
    });

    it("is idempotent on an already-noindexed document", () => {
        const once = rewriteRobotsMeta(
            '<head><meta name="robots" content="index, follow"/></head>',
        );
        expect(rewriteRobotsMeta(once)).toBe(once);
    });
});

describe("NOINDEX_ROBOTS_TXT", () => {
    it("disallows everything for every agent", () => {
        expect(NOINDEX_ROBOTS_TXT).toContain("User-agent: *");
        expect(NOINDEX_ROBOTS_TXT).toContain("Disallow: /");
        expect(NOINDEX_ROBOTS_TXT).not.toContain("Sitemap");
    });
});

describe("robotsPolicyPlugin", () => {
    it("is inert without the noindex policy", () => {
        const plugin = robotsPolicyPlugin(undefined);
        expect(plugin.name).toBe("robots-policy");
        expect(plugin.active).toBe(false);
    });

    it("arms itself only on the explicit noindex policy", () => {
        expect(robotsPolicyPlugin("noindex").active).toBe(true);
        expect(robotsPolicyPlugin("index").active).toBe(false);
        expect(robotsPolicyPlugin("").active).toBe(false);
    });
});
