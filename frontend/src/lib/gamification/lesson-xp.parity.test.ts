/**
 * Cross-language parity for the lesson-XP rule (Phase 50B /
 * v1.33.0 / D-DEXIE-GAMIFICATION).
 *
 * Mirrors ``plugins/adaptive-learner-plugin-gamification/
 * tests/test_xp_parity.py``. Both tests read the same fixture
 * at ``tests/fixtures/lesson-xp-parity/`` and assert against
 * the same goldens. Python is the canonical regenerator (set
 * ``LESSON_XP_PARITY_REGEN=1`` on the Python side); this TS
 * test never regenerates — only asserts.
 *
 * If this test fails after a Python source change, the
 * regen was intentional and the TS port at ``lesson-xp.ts``
 * needs to converge. If this test fails without a Python
 * source change, the TS port has drifted.
 *
 * Reads from the filesystem via Node's ``fs`` — works in
 * Vitest's node environment with no extra setup. Same
 * pattern as the Phase 49F learning-repo parity test.
 */

import {readFileSync, readdirSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {calculateLessonSessionXp, computeStars} from "./lesson-xp";

// Walk up: __dirname = frontend/src/lib/gamification
// repo root = ../../../..
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const FIXTURE_DIR = join(REPO_ROOT, "tests", "fixtures", "lesson-xp-parity");
const INPUT_PATH = join(FIXTURE_DIR, "input.json");
const EXPECTED_DIR = join(FIXTURE_DIR, "expected");

interface ComputeStarsCase {
    name: string;
    correct: number;
    total: number;
    expected_stars: number;
}

interface CalculateXpCase {
    name: string;
    stars: number;
    first_attempt: boolean;
    streak_days: number;
    xp_multiplier?: number;
}

interface ParityFixture {
    compute_stars_cases: ComputeStarsCase[];
    calculate_xp_cases: CalculateXpCase[];
}

function loadFixture(): ParityFixture {
    return JSON.parse(readFileSync(INPUT_PATH, "utf-8"));
}

function loadGolden(caseName: string): unknown {
    const path = join(EXPECTED_DIR, `${caseName}.json`);
    return JSON.parse(readFileSync(path, "utf-8"));
}

describe("lesson-XP cross-language parity", () => {
    it("computeStars matches every fixture case", () => {
        const fixture = loadFixture();
        for (const c of fixture.compute_stars_cases) {
            const actual = computeStars(c.correct, c.total);
            expect(actual, `compute_stars case '${c.name}'`).toBe(
                c.expected_stars,
            );
        }
    });

    it("calculateLessonSessionXp matches every Python golden", () => {
        const fixture = loadFixture();
        for (const c of fixture.calculate_xp_cases) {
            const award = calculateLessonSessionXp({
                stars: c.stars,
                first_attempt: c.first_attempt,
                streak_days: c.streak_days,
                xp_multiplier: c.xp_multiplier ?? 1.0,
            });
            const payload = {
                xp_earned: award.xp_earned,
                multiplier: award.multiplier,
                breakdown: award.breakdown,
                reason: award.reason,
            };
            const expected = loadGolden(c.name);
            expect(payload, `XP case '${c.name}'`).toEqual(expected);
        }
    });

    it("golden file set matches fixture case set", () => {
        const fixture = loadFixture();
        const fixtureNames = new Set(fixture.calculate_xp_cases.map((c) => c.name));
        const goldenNames = new Set(
            readdirSync(EXPECTED_DIR)
                .filter((f) => f.endsWith(".json"))
                .map((f) => f.replace(/\.json$/, "")),
        );
        expect(goldenNames).toEqual(fixtureNames);
    });
});
