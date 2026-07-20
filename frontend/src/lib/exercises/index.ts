/**
 * Public API of the exercise kit (#1862). One import surface for the
 * exercise-authoring logic — deterministic generation, per-type inline
 * editing (core + extension), and lesson assembly — so consumers never reach
 * into individual authoring modules.
 *
 * Scope note: the grading + payload VALIDATORS (categorization, token-diff,
 * …) still live flat under ``lib/exercises/`` and are imported directly by
 * the renderers today; their physical move into ``grading/`` + ``payload/``
 * subfolders and re-export from here is the deferred follow-up #1867. The
 * app-side i18n templates (``exercise-prompts``) and the storage-contract
 * builder (``user-set-input``) intentionally stay under
 * ``lib/content/lesson/`` — they are consumers of this kit, not part of it.
 */

export * from "./authoring/exercise-builder";
export * from "./authoring/exercise-edit";
export * from "./authoring/extension-edit";
export * from "./authoring/id-factory";
export * from "./authoring/lesson-assembly";
