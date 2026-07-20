/**
 * Barrel for the app-side exercise-prompt concern of the lesson pipeline:
 * the localized default-prompt templates and the opportunistic legacy-prompt
 * migration (#1860). The exercise-authoring logic (generation + inline
 * editing) moved to ``lib/exercises`` in #1862; import it from there.
 */

export * from "./exercise-prompts";
export * from "./legacy-prompt-migration";
