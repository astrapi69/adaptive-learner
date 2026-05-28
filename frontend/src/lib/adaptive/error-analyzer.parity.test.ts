/**
 * Cross-language parity for the adaptive-lesson error analyzer
 * (Phase 53A / v1.36.0 / EXP-013 / Q-114).
 *
 * Reads the same fixture + goldens the Python test at
 * ``backend/tests/test_adaptive_lesson_parity.py`` pins.
 * Python is the canonical regenerator; this TS side only
 * asserts. If the test fails after an intentional algorithm
 * change, regenerate goldens via Python and port the
 * algorithm change here.
 *
 * Equality is checked on the structural JSON (Python's
 * ``json.dumps(..., sort_keys=True)``-equivalent shape).
 * Floating-point fields are compared structurally; the
 * analyzer rounds the only float (``weakness_profile``
 * shares) to 3 decimals upstream, so bit-equality on floats
 * holds — but parsed JSON gives us numbers, not strings, so
 * the comparison is value-equal, not byte-equal at the
 * stringified level. The Python test's byte-equality check
 * pins the canonical bytes; this side pins the parsed values.
 *
 * Same pattern as Phase 50's gamification parity test.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import type {ElementError} from "../../storage/types";

import {analyzeErrors} from "./error-analyzer";

// frontend/src/lib/adaptive → ../../../.. = repo root
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const FIXTURE_DIR = join(
    REPO_ROOT,
    "tests",
    "fixtures",
    "adaptive-lesson-parity",
);
const INPUT_PATH = join(FIXTURE_DIR, "input.json");
const EXPECTED_DIR = join(FIXTURE_DIR, "expected");

interface ParityErrorRow {
    element_key: string;
    set_id: string;
    lesson_id: string;
    exercise_id: string;
    element_type: string;
    user_answer: string;
    correct_answer: string;
    error_count: number;
    correct_streak: number;
    last_error_at: string | null;
    last_attempt_at: string;
    mastered: boolean;
}

interface ParityCase {
    name: string;
    errors: ParityErrorRow[];
}

interface ParityFixture {
    now: string;
    focus_count: number;
    cases: ParityCase[];
}

function loadFixture(): ParityFixture {
    return JSON.parse(readFileSync(INPUT_PATH, "utf-8"));
}

function loadGolden(caseName: string): unknown {
    return JSON.parse(
        readFileSync(join(EXPECTED_DIR, `${caseName}.json`), "utf-8"),
    );
}

/** Convert a fixture row into the full ``ElementError`` shape the
 *  analyzer expects. The fixture omits ``id`` / ``user_id`` /
 *  ``created_at`` / ``updated_at`` / ``mastered_at`` since the
 *  analyzer ignores them; we fill them with deterministic
 *  placeholders so the type-check passes. */
function toElementError(row: ParityErrorRow): ElementError {
    return {
        id: `parity-${row.element_key}`,
        user_id: "parity-user",
        set_id: row.set_id,
        lesson_id: row.lesson_id,
        exercise_id: row.exercise_id,
        element_key: row.element_key,
        element_type: row.element_type,
        user_answer: row.user_answer,
        correct_answer: row.correct_answer,
        error_count: row.error_count,
        correct_streak: row.correct_streak,
        last_error_at: row.last_error_at,
        last_attempt_at: row.last_attempt_at,
        mastered: row.mastered,
        mastered_at: row.mastered ? row.last_attempt_at : null,
        created_at: row.last_attempt_at,
        updated_at: row.last_attempt_at,
    };
}

/** Project the TS ``ErrorAnalysis`` to the same shape Python's
 *  ``analysis_to_dict`` emits — strips the TS-side noise fields
 *  the Python dataclasses don't carry. */
function analysisToDict(result: ReturnType<typeof analyzeErrors>): unknown {
    return {
        prioritized_elements: result.prioritized_elements.map(_pickElement),
        error_clusters: result.error_clusters.map(_pickCluster),
        weakness_profile: Object.fromEntries(
            Object.entries(result.weakness_profile).sort(([a], [b]) =>
                a < b ? -1 : a > b ? 1 : 0,
            ),
        ),
        suggested_focus: result.suggested_focus.map(_pickElement),
        total_errors: result.total_errors,
        active_elements: result.active_elements,
    };
}

function _pickElement(p: ReturnType<typeof analyzeErrors>["prioritized_elements"][number]) {
    return {
        element_key: p.element_key,
        set_id: p.set_id,
        lesson_id: p.lesson_id,
        exercise_id: p.exercise_id,
        element_type: p.element_type,
        error_count: p.error_count,
        correct_streak: p.correct_streak,
        last_error_at: p.last_error_at,
        last_attempt_at: p.last_attempt_at,
        user_answer: p.user_answer,
        correct_answer: p.correct_answer,
        recency_weight: p.recency_weight,
        priority_score: p.priority_score,
    };
}

function _pickCluster(c: ReturnType<typeof analyzeErrors>["error_clusters"][number]) {
    return {
        cluster_type: c.cluster_type,
        key: c.key,
        element_keys: c.element_keys,
        error_count_total: c.error_count_total,
    };
}

describe("error analyzer cross-language parity", () => {
    const fixture = loadFixture();

    for (const testCase of fixture.cases) {
        it(`matches Python golden for ${testCase.name}`, () => {
            const errors = testCase.errors.map(toElementError);
            const result = analyzeErrors(errors, {
                now: fixture.now,
                focusCount: fixture.focus_count,
            });
            const actual = analysisToDict(result);
            const expected = loadGolden(testCase.name);
            expect(actual).toEqual(expected);
        });
    }
});
