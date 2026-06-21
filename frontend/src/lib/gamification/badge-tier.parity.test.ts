/**
 * Badge-tier cross-language parity (Phase 57 / v1.40.0 / P-158).
 *
 * Asserts the TypeScript tier rule (evaluateBadgeTier + tierUpgradeXp
 * in src/storage/badges.ts) agrees with the shared golden at
 * tests/fixtures/badge-tier-parity/input.json. The Python half lives
 * at plugins/adaptive-learner-plugin-gamification/tests/test_badge_tier.py.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {evaluateBadgeTier, tierUpgradeXp} from "../../storage/gamification/badges";

// __dirname = frontend/src/lib/gamification -> repo root is 4 up.
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const FIXTURE = join(
    REPO_ROOT,
    "tests",
    "fixtures",
    "badge-tier-parity",
    "input.json",
);

interface Threshold {
    threshold: number;
    xp_bonus: number;
}
interface Fixture {
    evaluate_tier_cases: {
        name: string;
        thresholds_ref: string;
        value: number;
        expected_tier: string | null;
    }[];
    upgrade_xp_cases: {
        name: string;
        thresholds_ref: string;
        old_tier: string | null;
        new_tier: string;
        expected_xp: number;
    }[];
    [key: string]: unknown;
}

const data = JSON.parse(readFileSync(FIXTURE, "utf-8")) as Fixture;

function thresholds(ref: string): Record<string, Threshold> {
    return data[ref] as Record<string, Threshold>;
}

describe("badge-tier parity (evaluateBadgeTier)", () => {
    for (const c of data.evaluate_tier_cases) {
        it(`${c.name}: value ${c.value} -> ${c.expected_tier}`, () => {
            expect(evaluateBadgeTier(c.value, thresholds(c.thresholds_ref))).toBe(
                c.expected_tier,
            );
        });
    }
});

describe("badge-tier parity (tierUpgradeXp)", () => {
    for (const c of data.upgrade_xp_cases) {
        it(`${c.name}: ${c.old_tier} -> ${c.new_tier} = ${c.expected_xp} XP`, () => {
            expect(
                tierUpgradeXp(c.old_tier, c.new_tier, thresholds(c.thresholds_ref)),
            ).toBe(c.expected_xp);
        });
    }
});
