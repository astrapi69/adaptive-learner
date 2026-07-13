import {describe, it, expect} from "vitest";

import schema from "../../../lib/content/validation/lesson.schema.generated.json";
import {
    SUPPORTED_EXERCISE_TYPES,
    SUPPORTED_EXT_EXERCISE_TYPES,
} from "./ExerciseDispatcher";
import {SUPPORTED_EXTENSIONS} from "../../../lib/content/validation/lesson-schema-validator";

/**
 * Engine-parity lock (EXP-042 / learn-content-engine).
 *
 * The canonical exercise-type catalogue is the App-authoritative schema's
 * ``ExerciseType`` enum — whose own description is "which exercise renderer
 * handles this step". Every canonical type MUST be covered by the
 * dispatcher's renderer registry (``SUPPORTED_EXERCISE_TYPES``), and the
 * registry must not claim a type the schema doesn't define.
 *
 * If a future canonical type is added to the schema without a renderer (or a
 * renderer key drifts from the enum), this goes RED — catching exactly the
 * "the canonical format allows a type the app can't render" class. That is
 * the root cause behind the React-Grundlagen MC report
 * (astrapi69/adaptive-learner-content-test#10). Since schema v1.6 (#1525)
 * text multiple-choice has a native ``multiple_choice`` type which COEXISTS
 * with the ``cloze`` select/multiselect vehicle (#890/#1195) — both stay
 * rendered, and this test proves the catalogue is fully rendered.
 */
const CANONICAL_EXERCISE_TYPES: readonly string[] = (
    schema as unknown as {$defs: {ExerciseType: {enum: string[]}}}
).$defs.ExerciseType.enum;

describe("ExerciseDispatcher — canonical exercise-type parity", () => {
    it("registers a renderer for every canonical schema ExerciseType", () => {
        const missing = CANONICAL_EXERCISE_TYPES.filter(
            (type) => !SUPPORTED_EXERCISE_TYPES.has(type),
        );
        expect(missing).toEqual([]);
    });

    it("registers no renderer key outside the canonical schema enum", () => {
        const extra = [...SUPPORTED_EXERCISE_TYPES].filter(
            (type) => !CANONICAL_EXERCISE_TYPES.includes(type),
        );
        expect(extra).toEqual([]);
    });

    it("covers cloze — the legacy multiple-choice vehicle stays rendered (#890)", () => {
        // Coexistence (#1525): cloze select/multiselect remains a fully
        // valid MC authoring form next to the native type.
        expect(CANONICAL_EXERCISE_TYPES).toContain("cloze");
        expect(SUPPORTED_EXERCISE_TYPES.has("cloze")).toBe(true);
    });

    it("covers multiple_choice — the native MC type (schema v1.6, #1525)", () => {
        expect(CANONICAL_EXERCISE_TYPES).toContain("multiple_choice");
        expect(SUPPORTED_EXERCISE_TYPES.has("multiple_choice")).toBe(true);
    });
});


describe("ExerciseDispatcher — adopted extension-type parity (#1579)", () => {
    // The extension analogue of the core lock above: the dispatcher's ext
    // renderer registry and the load guard's SUPPORTED_EXTENSIONS must agree
    // in both directions, so "the guard loads it" always implies "the
    // dispatcher renders it" - the E-EXT-UNSUPPORTED contract, app-side.
    const extTypePattern = (
        schema as unknown as {$defs: {ExtExerciseType: {pattern: string}}}
    ).$defs.ExtExerciseType.pattern;
    // eslint-disable-next-line security/detect-non-literal-regexp -- the pattern is the app's own bundled schema artifact, not user input
    const EXT_TYPE_PATTERN = new RegExp(extTypePattern);

    it("every ext renderer key matches the schema ExtExerciseType pattern", () => {
        const malformed = [...SUPPORTED_EXT_EXERCISE_TYPES].filter(
            (type) => !EXT_TYPE_PATTERN.test(type),
        );
        expect(malformed).toEqual([]);
    });

    it("registers a renderer for every extension the load guard adopts", () => {
        const missing = SUPPORTED_EXTENSIONS.filter(
            (type) => !SUPPORTED_EXT_EXERCISE_TYPES.has(type),
        );
        expect(missing).toEqual([]);
    });

    it("claims no ext renderer key the load guard has not adopted", () => {
        const extra = [...SUPPORTED_EXT_EXERCISE_TYPES].filter(
            (type) => !SUPPORTED_EXTENSIONS.includes(type),
        );
        expect(extra).toEqual([]);
    });

    it("keeps ext types out of the core registry (the two sets are disjoint)", () => {
        const overlap = [...SUPPORTED_EXT_EXERCISE_TYPES].filter((type) =>
            SUPPORTED_EXERCISE_TYPES.has(type),
        );
        expect(overlap).toEqual([]);
    });
});
