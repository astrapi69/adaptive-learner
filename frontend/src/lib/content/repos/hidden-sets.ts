/**
 * App-side blocklist of content sets that must never surface to learners
 * (#1702).
 *
 * Some sets in connected content repos are technical reference/conformance
 * fixtures, not learner content. The canonical example is the graded-quiz demo
 * in ``adaptive-learner-content-test`` (set id ``graded-quiz-demo-from-de``): it
 * is the deliberate ``E-EXT-UNSUPPORTED`` negative case in the engine's
 * real-content conformance run, so it MUST stay on disk in the content repo —
 * but it does not belong in "Inhalte entdecken" (Discover) or "Meine Inhalte"
 * (My Content) when a user connects that repo directly. (It is NOT in the
 * official ``recommended-repos.json``, so only directly-connected content-test
 * users ever see it.)
 *
 * This is a pragmatic INTERIM guard. The proper fix is a ``visibility: hidden``
 * (or ``dev_only: true``) flag on the manifest set entry, which is blocked
 * today because the content-manifest set-entry schema in
 * ``learn-content-engine`` is strict (``additionalProperties: false``): the
 * field must first be added there, or ``validateManifest()`` (run by the engine
 * conformance job AND each content repo's CI gate) would reject the manifest.
 * Once the engine schema supports it: set the flag in content-test's manifest +
 * search-index generator, read it in the app filter, and delete this module.
 * See #1702.
 *
 * Keyed ``owner/repo::set-id`` — the same identity as
 * {@link discoverSetKey} in ``discover-index.ts``.
 */

/** The set of hidden ``owner/repo::set-id`` keys. */
const HIDDEN_SET_KEYS: ReadonlySet<string> = new Set([
  // Engine conformance ``E-EXT-UNSUPPORTED`` negative-case fixture (#1702).
  "astrapi69/adaptive-learner-content-test::graded-quiz-demo-from-de",
]);

/** Build the ``owner/repo::set-id`` identity key for a set. */
export function hiddenSetKey(source: string, id: string): string {
  return `${source}::${id}`;
}

/**
 * True when a set is a hidden reference/conformance fixture that must not
 * surface to learners (#1702). ``source`` is the ``owner/repo`` identifier the
 * set came from (``repo_url`` on a discovered set, ``source`` on a cached
 * {@link ContentSetEntry}); ``id`` is the set id.
 */
export function isHiddenSet(source: string, id: string): boolean {
  return HIDDEN_SET_KEYS.has(hiddenSetKey(source, id));
}
