/**
 * Small, defensive field coercers shared by the AI-card parser
 * ({@link ../exercise-generation-parser}) and the extension-card builder
 * ({@link ./extension-cards}). Extracted so both can reuse them without a
 * circular import (the parser depends on the extension builder).
 *
 * Library-grade: pure, no imports.
 */

/** A non-empty trimmed string, or null. */
export function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Array of non-empty strings (drops empties), or [] when not an array. */
export function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanString)
    .filter((entry): entry is string => entry !== null);
}

/** Coerce a truthy/"true" value to a boolean (the model is loose here). */
export function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}
