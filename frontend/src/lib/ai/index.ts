/**
 * Barrel for the AI helper layer (`lib/ai`), grouped by concern (#917).
 *
 * The folder was split into three concern groups; this barrel re-exports the
 * full public surface so consumers can import from `lib/ai` instead of reaching
 * into a specific subfolder. Existing deep imports
 * (`lib/ai/<group>/<module>`) keep working unchanged.
 *
 * - `generation/`  — AI exercise generation pipeline (prompt -> parse ->
 *   quality gate -> balance -> generate, plus per-set batching).
 * - `validation/`  — AI content-validation pipeline (validator, runner, cost,
 *   markdown export, provenance, content hash + signature).
 * - `providers/`   — AI provider/model resolution and provider-backed helpers
 *   (active-provider resolution, model recommendations, pronunciation).
 */

// generation/
export * from "./generation/cards-to-exercises";
export * from "./generation/exercise-distribution";
export * from "./generation/exercise-generation-parser";
export * from "./generation/exercise-generation-prompt";
export * from "./generation/exercise-quality-gate";
export * from "./generation/generate-exercises";
export * from "./generation/generate-exercises-for-set";
export * from "./generation/set-batch-deps";

// validation/
export * from "./validation/content-validator";
export * from "./validation/content-hash";
export * from "./validation/validation-cost";
export * from "./validation/validation-markdown";
export * from "./validation/validation-provenance";
export * from "./validation/validation-runner";
export * from "./validation/validation-signature";

// providers/
export * from "./providers/resolve-provider";
export * from "./providers/model-recommendations";
export * from "./providers/pronunciation-ai";
