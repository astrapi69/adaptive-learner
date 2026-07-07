/**
 * Content-source identity constants + the official-vs-user predicate.
 *
 * Extracted into a dependency-free leaf module so BOTH ``content-repos``
 * (the high-level config layer) and ``repo-token`` (the low-level credential
 * resolver) can share the same official-source definition without creating an
 * import cycle. ``content-repos`` re-exports these three symbols, so existing
 * importers of ``./content-repos`` keep working unchanged.
 */

/** Canonical identifier of the official content repository. */
export const OFFICIAL_SOURCE = "astrapi69/adaptive-learner-content";

/** Prefix marking a build-time bundled source (also "official"). */
export const BUNDLED_PREFIX = "bundled:";

/**
 * True when a cached set's ``source`` belongs to the official content
 * (the canonical repo or any bundled source). Everything else — a user
 * repo — is user content for badges + filtering.
 */
export function isOfficialSource(source: string): boolean {
  return source === OFFICIAL_SOURCE || source.startsWith(BUNDLED_PREFIX);
}
