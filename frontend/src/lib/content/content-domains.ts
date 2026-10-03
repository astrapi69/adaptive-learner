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
 *
 * Since engine 0.20.0 (engine#127 / #2335) the vocabulary itself comes
 * from the engine's ``KNOWN_CONTENT_DOMAINS`` — one list, one source; the
 * app no longer maintains its own copy. This module derives the
 * app-facing shapes (the NON-language Set, the picker options) from it.
 */

import {
  ENGINE_KNOWN_CONTENT_DOMAINS,
  ENGINE_LEVEL_NONE,
  engineIsKnownContentDomain,
} from "./engine";

/** The implicit domain for a language pair — carries no ``domain`` field on
 *  the built lesson (it is the schema default). */
export const DEFAULT_DOMAIN = "language";

/** Content domains the validator recognises as NON-language — source ==
 *  target is allowed for these (mirrors the content repo's
 *  ``validate_content.py`` domain relaxation). Derived from the engine's
 *  canonical vocabulary (engine#127) minus the language default.
 *  Insertion order drives {@link DOMAIN_OPTIONS}. */
export const KNOWN_CONTENT_DOMAINS: ReadonlySet<string> = new Set(
  ENGINE_KNOWN_CONTENT_DOMAINS.filter((domain) => domain !== DEFAULT_DOMAIN),
);

/** The domain choices an authoring picker offers: the default language
 *  domain first, then the known non-language domains. */
export const DOMAIN_OPTIONS: readonly string[] = [
  DEFAULT_DOMAIN,
  ...KNOWN_CONTENT_DOMAINS,
];

// Radix Select forbids a literal empty-string item value, so the explicit
// "no level" choice uses this sentinel and maps back to "" in the handler -
// keeping a genuinely level-less knowledge lesson expressible. A manifest
// writer turns that "" into the engine's "none" via normalizeLevel (#3385).
export const LEVEL_NONE = "__none__";

/** A stored level as the manifest schema expects it: a missing or empty
 *  level (written before #3385) becomes the engine's ``"none"``. */
export function normalizeLevel(level: string | null | undefined): string {
  const value = (level ?? "").trim();
  return value === "" ? ENGINE_LEVEL_NONE : value;
}

/** True when ``domain`` names a known NON-language content domain
 *  (case-insensitive). ``"language"``, empty, and unknown values are false.
 *
 *  #3397 - this is the app's own question ("knowledge content?"), not the
 *  engine's ``isKnownContentDomain`` ("a known domain?", which counts
 *  ``language`` and empty as known). It is built on the engine's answer and
 *  named for its own, so the two can no longer be mistaken. */
export function isKnowledgeDomain(
  domain: string | null | undefined,
): boolean {
  const value = (domain || "").trim().toLowerCase();
  return value !== "" && value !== DEFAULT_DOMAIN && engineIsKnownContentDomain(value);
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
