/**
 * Pure content language/domain helpers, extracted from content-tree.ts
 * (#540) so that both `content-tree.ts` and `tree-placement.ts` can
 * import them without forming an import cycle (content-tree imports the
 * placement matcher; the placement matcher needs these helpers).
 *
 * No side effects, no app-specific imports beyond the shared type.
 */

import type { ContentSetEntry } from "../../storage/types";

/** Base subtag of a BCP-47 code: "de-AT" -> "de", "FR" -> "fr". */
export function baseLanguage(code: string): string {
  return (code || "").split("-")[0].toLowerCase();
}

/** Normalised content domain; "language" when unset. Mirrors the
 *  content-validator + the content repo's validate_content.py. */
export function domainOf(entry: ContentSetEntry): string {
  return (entry.domain || "language").trim().toLowerCase();
}
