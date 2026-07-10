/**
 * Behaviour fixtures for the schema-authority migration (Phase 0, #1516).
 *
 * Pins what the app's ajv structural lesson validation
 * (``validateLessonShape``, compiled from the generated lesson
 * JSON-Schema) ACCEPTS and REJECTS today, so the Phase 2 flip (``$id``
 * moves to the engine-own URL, the app becomes the schema consumer) can
 * prove the runtime behaviour did not change: fixtures and assertions
 * stay byte-identical across the flip.
 *
 * Shared fixture corpus with the backend Pydantic pin
 * (``backend/tests/test_lesson_behavior_fixtures.py``), cross-language
 * parity pattern:
 *
 * - ``valid/``            shape-valid here AND accepted by Pydantic
 * - ``invalid/``          structural violations — rejected by BOTH layers
 * - ``invalid-semantic/`` cross-field violations — the STRUCTURAL check
 *   here passes them BY DESIGN (JSON-Schema cannot express them); the
 *   semantic layer lives in ``validateGeneratedLesson`` / the Pydantic
 *   model validators. Pinning the pass documents the layer split.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validateLessonShape } from "./lesson-schema-validator";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = resolve(HERE, "../../../../..", "tests/fixtures/lesson-schema-behavior");

function fixtureNames(subdir: string): string[] {
  return readdirSync(resolve(FIXTURES_ROOT, subdir))
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function loadFixture(subdir: string, name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES_ROOT, subdir, name), "utf-8"));
}

describe("lesson behaviour fixtures (schema-authority migration Phase 0)", () => {
  it("keeps the full pre-flip fixture corpus", () => {
    expect(fixtureNames("valid")).toEqual([
      "full-all-exercise-types.json",
      "minimal-theory-only.json",
    ]);
    expect(fixtureNames("invalid")).toEqual([
      "missing-required-title.json",
      "steps-not-an-array.json",
      "unknown-exercise-type.json",
      "unknown-top-level-field.json",
    ]);
    expect(fixtureNames("invalid-semantic")).toEqual([
      "cloze-marker-mismatch.json",
      "exercise-references-unknown-card.json",
      "matching-without-pairs.json",
    ]);
  });

  it.each(fixtureNames("valid"))("accepts valid/%s", (name) => {
    const result = validateLessonShape(loadFixture("valid", name));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each(fixtureNames("invalid"))("rejects invalid/%s", (name) => {
    const result = validateLessonShape(loadFixture("invalid", name));
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it.each(fixtureNames("invalid-semantic"))(
    "passes the STRUCTURAL check for invalid-semantic/%s (semantic layer rejects it)",
    (name) => {
      const result = validateLessonShape(loadFixture("invalid-semantic", name));
      expect(result.errors).toEqual([]);
      expect(result.ok).toBe(true);
    },
  );
});
