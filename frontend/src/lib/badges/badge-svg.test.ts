/**
 * Tests for the tier-coloured badge SVG generator (Phase 57 / D-127).
 */

import {describe, expect, it} from "vitest";

import {BUNDLED_BADGES} from "../../storage/badges";
import {
    generateBadgeSvg,
    KEY_TO_SHAPE,
    shapeForKey,
    TIER_PALETTE,
    type BadgeTier,
} from "./badge-svg";

const TIERS: BadgeTier[] = ["bronze", "silver", "gold", "locked"];

describe("generateBadgeSvg", () => {
    it("returns a valid inline SVG data URI for every key x tier", () => {
        for (const badge of BUNDLED_BADGES) {
            for (const tier of TIERS) {
                const uri = generateBadgeSvg(badge.key, tier);
                expect(uri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
                const svg = decodeURIComponent(
                    uri.slice("data:image/svg+xml;utf8,".length),
                );
                expect(svg.startsWith("<svg")).toBe(true);
                expect(svg.endsWith("</svg>")).toBe(true);
                expect(svg).toContain('viewBox="0 0 64 64"');
            }
        }
    });

    it("uses the tier's primary colour in the medallion fill", () => {
        for (const tier of TIERS) {
            const uri = generateBadgeSvg("level_5", tier);
            const svg = decodeURIComponent(uri.split(",").slice(1).join(","));
            expect(svg).toContain(TIER_PALETTE[tier].primary);
            expect(svg).toContain(TIER_PALETTE[tier].secondary);
        }
    });

    it("is deterministic: same (key, tier) -> identical bytes", () => {
        expect(generateBadgeSvg("streak_3_days", "gold")).toBe(
            generateBadgeSvg("streak_3_days", "gold"),
        );
    });

    it("locked tier differs from earned tiers (greyed medallion)", () => {
        const locked = generateBadgeSvg("review_master", "locked");
        const gold = generateBadgeSvg("review_master", "gold");
        expect(locked).not.toBe(gold);
        const lockedSvg = decodeURIComponent(locked.split(",").slice(1).join(","));
        expect(lockedSvg).toContain(TIER_PALETTE.locked.primary);
        // Glyph still present (shape carries meaning even when locked).
        expect(lockedSvg.length).toBeGreaterThan(120);
    });

    it("falls back to the star glyph for an unknown key", () => {
        expect(shapeForKey("totally-unknown-key")).toBe("star");
    });
});

describe("KEY_TO_SHAPE coverage", () => {
    it("maps every catalog badge key to a glyph", () => {
        const missing = BUNDLED_BADGES.filter(
            (b) => !(b.key in KEY_TO_SHAPE),
        ).map((b) => b.key);
        expect(missing).toEqual([]);
    });

    it("has no shape entries for keys outside the catalog", () => {
        const catalogKeys = new Set(BUNDLED_BADGES.map((b) => b.key));
        const extra = Object.keys(KEY_TO_SHAPE).filter(
            (k) => !catalogKeys.has(k),
        );
        expect(extra).toEqual([]);
    });
});
