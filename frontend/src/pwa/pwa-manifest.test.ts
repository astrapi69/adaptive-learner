/**
 * Tests for the Web App Manifest source of truth (#604 follow-up). Pins the
 * install-critical fields so they can't silently regress.
 */

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
