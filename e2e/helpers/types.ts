/**
 * Shared TypeScript types for the E2E helpers. Kept in their
 * own file so the spec files do not have to know about
 * Playwright-internal types when describing input fixtures.
 */

export type LearningMethod =
    | "deductive"
    | "inductive"
    | "error_based"
    | "dialogic"
    | "contextual"
    | "ai_adaptive";
