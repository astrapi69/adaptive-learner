/**
 * Pure helpers, constants, and types for the community Share Wizard.
 *
 * Extracted from ShareWizard so the wizard hook ({@link useShareWizard})
 * and the individual step components can share the language/level
 * predicates and the wizard-flow types without duplicating them.
 */

import { CEFR_LEVELS } from "../../../lib/content/language/language-options";
import {
  KNOWN_CONTENT_DOMAINS,
  LEVEL_NONE,
} from "../../../lib/content/content-domains";

// Re-exported from the shared content-domain module (#1716) so the Share
// wizard and the Create-Lesson wizard mirror ONE distinction. Existing
// imports of these names from shareWizardHelpers stay valid.
export { KNOWN_CONTENT_DOMAINS, LEVEL_NONE };

/** One of the four wizard steps. */
export type Step = 1 | 2 | 3 | 4;
/** How a single lesson is shared relative to an existing match. */
export type ShareMode = "full" | "variation" | "supplement";
/** Which GitHub flow the share used (drives the step-4 copy). */
export type ShareMethod = "pr" | "upload";

export const TOTAL_STEPS = 4;

/** Base subtag of a language code ("de-DE" -> "de"), lowercased. */
export function baseLang(code: string | null | undefined): string {
  return (code || "").split("-")[0].toLowerCase();
}

/** A plain ISO 639-1 base subtag (exactly two letters) — what the
 *  community tree requires. */
export function isIsoLang(code: string | null | undefined): boolean {
  return /^[a-z]{2}$/.test(baseLang(code));
}

const CEFR_SET: ReadonlySet<string> = new Set(CEFR_LEVELS as readonly string[]);

/** A valid CEFR level (A1..C2), case-insensitive. "imported" and other
 *  non-CEFR placeholders are rejected (BUG C). */
export function isCefr(level: string | null | undefined): boolean {
  return CEFR_SET.has((level || "").trim().toUpperCase());
}

export function defaultOpen(url: string): boolean {
  // window.open returns null when the popup is blocked; the caller
  // uses that to show a manual fallback link.
  const win = window.open(url, "_blank", "noopener,noreferrer");
  return win != null;
}
