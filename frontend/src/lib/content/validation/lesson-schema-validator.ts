/**
 * Structural lesson-shape validation via ajv against the lesson
 * JSON-Schema (EXP-039 / #1205; canonical schema home in
 * learn-content-engine since #1517).
 *
 * The shape (fields, types, closed enums, length/range bounds,
 * ``additionalProperties: false``) is validated against
 * ``schema/lesson.schema.json`` — generated from the app's Pydantic models
 * by ``make sync-schema`` and byte-parity-gated against the pinned
 * learn-content-engine release (the canonical schema source). The schema is
 * consumed here via its bundle-local, drift-gated mirror
 * (``lesson.schema.generated.json``), so this runtime check can never drift
 * from the Pydantic definition: change the model (after the engine-first
 * procedure), run ``make sync-schema``, and ajv automatically validates the
 * new shape — no hand-maintained mirror.
 *
 * This module covers ONLY the structural shape. Imperative cross-field /
 * semantic rules JSON-Schema cannot express (referential integrity
 * ``card_ids -> cards``, cloze ``___``-count == blanks, slug-safety +
 * uniqueness, picture-choice single-correct, ``accept_orderings``
 * permutation) stay in ``validateGeneratedLesson``.
 */

import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";

import lessonJsonSchema from "./lesson.schema.generated.json";

/** Result of a structural shape check. */
export interface ShapeResult {
  /** True when the value matches the lesson JSON-Schema. */
  ok: boolean;
  /** Human-readable structural errors (empty when ``ok``). */
  errors: string[];
}

/**
 * One compiled validator for the process. ``strict: false`` tolerates the
 * schema's non-standard annotation keywords (``x-schema-version``, ``$id``)
 * without turning them into compile errors; ``allErrors`` surfaces every
 * structural problem at once instead of stopping at the first.
 */
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const validateFn: ValidateFunction = ajv.compile(lessonJsonSchema);

/** Render one ajv error as ``<instancePath> <message>`` (root = "lesson"). */
function formatError(error: ErrorObject): string {
  const where = error.instancePath || "/lesson";
  const extra =
    error.keyword === "additionalProperties"
      ? ` (${String(error.params.additionalProperty)})`
      : "";
  return `${where} ${error.message ?? "is invalid"}${extra}`.trim();
}

/**
 * Validate a value's structural shape against the lesson JSON-Schema.
 *
 * @param value - any candidate lesson (typically a ``ContentLesson``).
 * @returns ``{ok, errors}`` — ``ok: true`` with no errors when the shape
 *   matches the schema, otherwise the list of structural violations.
 *
 * @example
 * const { ok, errors } = validateLessonShape(lesson);
 * if (!ok) throw new Error(errors[0]);
 */
export function validateLessonShape(value: unknown): ShapeResult {
  const ok = validateFn(value) as boolean;
  if (ok) return { ok: true, errors: [] };
  const errors = (validateFn.errors ?? []).map(formatError);
  return { ok: false, errors };
}
