/**
 * Shared content-domain vocabulary for the authoring + sharing surfaces
 * (#1716).
 *
 * A content set is either LANGUAGE content (a source→target language pair
 * + a CEFR level) or KNOWLEDGE content (a single content language, an
 * optional level-less shape). Both the community Share wizard and the
 * Create-Lesson wizard read this ONE module so they mirror a single
 * distinction instead of inventing two. ``shareWizardHelpers`` re-exports
 * ``KNOWN_CONTENT_DOMAINS`` + ``LEVEL_NONE`` from here for its existing
 * consumers.
 */

/** The implicit domain for a language pair — carries no ``domain`` field on
 *  the built lesson (it is the schema default). */
export const DEFAULT_DOMAIN = "language";

/** Content domains the validator recognises as NON-language — source ==
 *  target is allowed for these (mirrors the content repo's
 *  ``validate_content.py`` domain relaxation). Covers every non-language
 *  domain present in the official + registered content repos plus the
 *  reserved ``math``. Insertion order drives {@link DOMAIN_OPTIONS}. */
export const KNOWN_CONTENT_DOMAINS: ReadonlySet<string> = new Set([
  "knowledge",
  "programming",
  "psychology",
  "math",
  "ai",
  "technology",
  "software",
  "philosophy",
  "dog-training",
  "traffic-knowledge",
]);

/** The domain choices an authoring picker offers: the default language
 *  domain first, then the known non-language domains. */
export const DOMAIN_OPTIONS: readonly string[] = [
  DEFAULT_DOMAIN,
  ...KNOWN_CONTENT_DOMAINS,
];

// Radix Select forbids a literal empty-string item value, so the explicit
// "no level" choice uses this sentinel and maps back to "" in the handler —
// keeping a genuinely level-less knowledge lesson expressible.
export const LEVEL_NONE = "__none__";

/** True when ``domain`` names a known NON-language content domain
 *  (case-insensitive). ``"language"``, empty, and unknown values are false. */
export function isKnownContentDomain(
  domain: string | null | undefined,
): boolean {
  return KNOWN_CONTENT_DOMAINS.has((domain || "").toLowerCase());
}

/** The content domain to STAMP on a built lesson for a chosen authoring
 *  domain: the known non-language domain (lowercased), or ``undefined`` for
 *  the default language domain (which carries no ``domain`` field). */
export function contentDomainToStamp(
  domain: string | null | undefined,
): string | undefined {
  const value = (domain || "").toLowerCase();
  return KNOWN_CONTENT_DOMAINS.has(value) ? value : undefined;
}
