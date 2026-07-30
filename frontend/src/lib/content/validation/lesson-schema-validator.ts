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

import { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";

// Build-time-compiled validator (#2205): `ajv.compile` at runtime generates
// code via `new Function` - an `unsafe-eval` CSP violation that broke
// /content under the fixed policy. The standalone module is generated from
// the pinned schema mirror by scripts/generate-lesson-validator.mjs (wired
// into `make sync-schema`); a re-pin without regeneration is caught by the
// drift test, never silent.
import standaloneValidate from "./lesson-schema-validator.standalone.cjs";

/** Result of a structural shape check. */
export interface ShapeResult {
  /** True when the value matches the lesson JSON-Schema. */
  ok: boolean;
  /** Human-readable structural errors (empty when ``ok``). */
  errors: string[];
}

const validateFn = standaloneValidate as unknown as ValidateFunction;

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
/** Extensions this app has adopted (renderer + grader registered). Adopting
 *  one (engine 0.10.0 extension tier) means adding it here AND registering
 *  the consumer half - the load guard below refuses everything else. */
export const SUPPORTED_EXTENSIONS: readonly string[] = [
  "ext:al-categorization",
  "ext:al-error-correction",
  "ext:al-reading-comprehension",
  "ext:al-graded-quiz",
  "ext:al-dictation",
  "ext:al-image-description",
];

/** The extension-tier load guard (#1565): structurally a lesson declaring
 *  ``requires_extensions`` is valid schema 1.7, but loading it without the
 *  adopted extension would let the ext exercise fall through to unknown-type
 *  rendering - exactly the silent mis-rendering the engine contract
 *  (E-EXT-UNSUPPORTED) forbids. Refuse loudly, naming what is missing. */
function unsupportedExtensionErrors(value: unknown): string[] {
  const declared = (value as { requires_extensions?: unknown }).requires_extensions;
  if (!Array.isArray(declared)) return [];
  return declared
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => !SUPPORTED_EXTENSIONS.includes(entry.split("@")[0] ?? entry))
    .map(
      (entry) =>
        `/requires_extensions: this app does not support extension '${entry}' - the lesson is refused instead of mis-rendered`,
    );
}

/** The reserved prefix of every extension exercise type. */
const EXTENSION_TYPE_PREFIX = "ext:";

/** The reverse-consistency guard (#1895): a lesson that USES an extension
 *  exercise type but never DECLARES it in ``requires_extensions`` loads fine
 *  in an app that supports the extension yet falls through to unknown-type
 *  rendering in one that does not - the same E-EXT-UNSUPPORTED silent failure
 *  {@link unsupportedExtensionErrors} guards from the declaration side. This
 *  closes the class for EVERY build path (main wizard, book, edit), not just
 *  the extension wizard that already declares. Refuse loudly, naming the
 *  undeclared type. */
function undeclaredExtensionErrors(value: unknown): string[] {
  const lesson = value as {
    steps?: unknown;
    requires_extensions?: unknown;
  };
  const steps = Array.isArray(lesson.steps) ? lesson.steps : [];
  const declared = new Set(
    (Array.isArray(lesson.requires_extensions) ? lesson.requires_extensions : [])
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.split("@")[0] ?? entry),
  );
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const step of steps) {
    const type = (step as { exercise?: { type?: unknown } })?.exercise?.type;
    if (typeof type !== "string" || !type.startsWith(EXTENSION_TYPE_PREFIX)) {
      continue;
    }
    if (declared.has(type) || seen.has(type)) continue;
    seen.add(type);
    errors.push(
      `/requires_extensions: exercise type '${type}' is used but not declared in requires_extensions - the lesson would mis-render in an app without it`,
    );
  }
  return errors;
}

export function validateLessonShape(value: unknown): ShapeResult {
  const ok = validateFn(value) as boolean;
  if (!ok) {
    return { ok: false, errors: (validateFn.errors ?? []).map(formatError) };
  }
  const extensionErrors = [
    ...unsupportedExtensionErrors(value),
    ...undeclaredExtensionErrors(value),
  ];
  if (extensionErrors.length > 0) return { ok: false, errors: extensionErrors };
  return { ok: true, errors: [] };
}
