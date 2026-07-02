import {describe, it, expect} from "vitest";

import schema from "../../../lib/content/validation/lesson.schema.generated.json";
import {SUPPORTED_EXERCISE_TYPES} from "./ExerciseDispatcher";

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
 * (astrapi69/adaptive-learner-content-test#10): single-answer multiple-choice
 * is the ``cloze`` select-mode renderer (#890), not a missing type — and this
 * test proves the catalogue is fully rendered.
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

    it("covers cloze — the canonical single-answer multiple-choice renderer (#890)", () => {
        // MC is authored as cloze `select` mode, not a separate
        // multiple_choice type; the renderer for it must exist.
        expect(CANONICAL_EXERCISE_TYPES).toContain("cloze");
        expect(SUPPORTED_EXERCISE_TYPES.has("cloze")).toBe(true);
    });
});
