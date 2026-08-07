/**
 * Tests for the Web App Manifest source of truth (#604 follow-up). Pins the
 * install-critical fields so they can't silently regress.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import { describe, expect, it } from "vitest";

import { buildPwaManifest } from "./pwa-manifest";

describe("buildPwaManifest", () => {
    it("uses display: standalone (chrome-less installed PWA, not fullscreen)", () => {
        expect(buildPwaManifest("/").display).toBe("standalone");
    });

    it("carries the required install fields", () => {
        const m = buildPwaManifest("/");
        expect(m.name).toBeTruthy();
        expect(m.short_name).toBeTruthy();
        expect(m.short_name.length).toBeLessThanOrEqual(12);
        expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(m.start_url).toBe("/");
        expect(m.scope).toBe("/");
    });

    it("includes a maskable icon and at least one any-purpose icon", () => {
        const m = buildPwaManifest("/");
        expect(m.icons.some((i) => i.purpose === "maskable")).toBe(true);
        expect(m.icons.some((i) => i.purpose === "any")).toBe(true);
        // Never the combined "any maskable" — separate entries only.
        expect(m.icons.every((i) => i.purpose === "any" || i.purpose === "maskable")).toBe(
            true,
        );
    });

    it("prefixes start_url / scope / icon src with the deployment base", () => {
        const m = buildPwaManifest("/adaptive-learner/");
        expect(m.start_url).toBe("/adaptive-learner/");
        expect(m.scope).toBe("/adaptive-learner/");
        expect(m.icons[0].src.startsWith("/adaptive-learner/")).toBe(true);
    });
});

describe("precache manifest has one source per html file (#2499)", () => {
    it("includeAssets lists no .html entry - the workbox glob owns html", () => {
        // offline.html listed in BOTH includeAssets and the
        // "**/*.html" globPatterns sweep produced two precache rows
        // with conflicting revisions; Workbox then rejects the whole
        // list at SW install time and nothing is precached. The glob
        // is the single owner of html entries.
        const config = readFileSync(
            join(process.cwd(), "vite.config.ts"),
            "utf-8",
        );
        const includeAssets = config.match(
            /includeAssets:\s*\[([^\]]*)\]/,
        );
        expect(includeAssets, "includeAssets block not found").toBeTruthy();
        // Assert on the ENTRIES only - the block's comment names
        // offline.html to explain the rule and must not trip it.
        const entries = includeAssets![1]
            .split("\n")
            .filter((line) => !line.trim().startsWith("//"))
            .join("\n");
        expect(entries).not.toMatch(/\.html/);
    });
});
