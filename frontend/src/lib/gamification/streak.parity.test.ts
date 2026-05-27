/**
 * Streak helper cross-language parity (Phase 50C / v1.33.0 /
 * D-DEXIE-GAMIFICATION).
 *
 * Mirrors the Python ``test_current_streak_days_matches_inline_expected``
 * test in ``plugins/adaptive-learner-plugin-gamification/
 * tests/test_xp_parity.py``. Both read the same fixture and
 * assert the same integer streak counts.
 *
 * Streak input shapes differ between languages (Python:
 * ``set[date]``, TS: ``Set<string>``) — see ``streak.ts`` header
 * for the rationale. Output integers are byte-equal across both.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {currentStreakDays} from "./streak";

// Walk up: __dirname = frontend/src/lib/gamification
// repo root = ../../../..
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const INPUT_PATH = join(
    REPO_ROOT,
    "tests",
    "fixtures",
    "lesson-xp-parity",
    "input.json",
);

interface StreakCase {
    name: string;
    activity_dates: string[];
    today: string;
    expected_streak: number;
}

function loadStreakCases(): StreakCase[] {
    const fixture = JSON.parse(readFileSync(INPUT_PATH, "utf-8"));
    return fixture.streak_cases;
}

describe("currentStreakDays cross-language parity", () => {
    it("matches the Python expected streak for every fixture case", () => {
        for (const c of loadStreakCases()) {
            const activity_dates = new Set(c.activity_dates);
            const actual = currentStreakDays(activity_dates, c.today);
            expect(actual, `streak case '${c.name}'`).toBe(c.expected_streak);
        }
    });
});
