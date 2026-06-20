/**
 * Cross-language badge-catalog parity (Phase 61 follow-up).
 *
 * Asserts BUNDLED_BADGES (badges-data.ts) matches the frozen golden
 * at tests/fixtures/badge-catalog/catalog.json — the same file the
 * Python half (badges.yaml) is pinned against in
 * plugins/.../tests/test_badge_catalog_parity.py. A badge added, or a
 * base_tier / threshold changed, on one side without the other fails
 * the build instead of silently diverging API-mode and Dexie-mode
 * users. Tier EVALUATION is pinned separately in
 * badge-tier.parity.test.ts; this pins the CATALOG itself.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {BUNDLED_BADGES} from "./dexie/badges-data";

interface GoldenEntry {
    key: string;
    name_key: string;
    description_key: string;
    icon: string;
    category: string;
    base_tier: string;
    tier_thresholds: Record<
        string,
        {threshold: number; xp_bonus: number}
    > | null;
}

// __dirname = frontend/src/storage -> repo root is 3 up.
const GOLDEN_PATH = join(
    __dirname,
    "..",
    "..",
    "..",
    "tests",
    "fixtures",
    "badge-catalog",
    "catalog.json",
);
const golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf-8")) as GoldenEntry[];

function normalize(badge: (typeof BUNDLED_BADGES)[number]): GoldenEntry {
    return {
        key: badge.key,
        name_key: badge.name_key,
        description_key: badge.description_key,
        icon: badge.icon,
        category: badge.category,
        base_tier: badge.base_tier ?? "bronze",
        tier_thresholds: badge.tier_thresholds ?? null,
    };
}

describe("badge catalog cross-language parity", () => {
    it("matches the golden count (28) and key set", () => {
        expect(BUNDLED_BADGES).toHaveLength(28);
        expect(golden).toHaveLength(28);
        expect(new Set(BUNDLED_BADGES.map((b) => b.key))).toEqual(
            new Set(golden.map((e) => e.key)),
        );
    });

    it("matches the golden field-for-field per badge", () => {
        const goldenByKey = new Map(golden.map((e) => [e.key, e]));
        for (const badge of BUNDLED_BADGES) {
            expect(normalize(badge)).toEqual(goldenByKey.get(badge.key));
        }
    });
});
