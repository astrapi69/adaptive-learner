/**
 * Development / reference sets that must NEVER surface in a user-facing list —
 * neither "Inhalte entdecken" (Discover) nor "Meine Inhalte" (My Content) —
 * even when the repo that hosts them is connected as a user content repo.
 *
 * WHY A HARDCODED BLOCKLIST (and not a manifest flag): the content-manifest
 * set-entry schema is strict (``additionalProperties: false``), so a
 * ``visibility: hidden`` / ``dev_only`` field cannot be added to a set entry
 * until the engine schema (learn-content-engine) grows it first — otherwise
 * ``validateManifest()`` (run by the engine's real-content conformance job AND
 * by each content repo's own CI gate) would reject the manifest. This app-side
 * blocklist is the pragmatic interim: it hides the set from users while the set
 * stays physically in its repo, so the engine's conformance run keeps using it
 * as the deliberate ``E-EXT-UNSUPPORTED`` (extension-not-registered) negative
 * case.
 *
 * Keys are ``owner/repo::set-id`` — a set is identified the same way in both
 * lists: {@link SearchableSet.repo_url} + ``id`` for Discover, and
 * {@link ContentSetEntry.source} + ``id`` for My Content.
 *
 * TODO(#1702): replace this list with a ``visibility: hidden`` manifest flag
 * once the engine set-entry schema supports it, then delete this module.
 */

/** ``owner/repo::set-id`` keys of sets hidden from every user-facing list. */
const HIDDEN_SET_KEYS: ReadonlySet<string> = new Set([
  // Graded-Quiz Demo (Test) — the ext:al-graded-quiz reference / conformance
  // fixture in the test/starter repo. A technical mechanics demo, not learner
  // content; it is the intentional E-EXT-UNSUPPORTED case in the engine's
  // real-content conformance run and stays on disk for that reason.
  "astrapi69/adaptive-learner-content-test::graded-quiz-demo-from-de",
]);

/**
 * True when a set (identified by its ``owner/repo`` source + set id) is a
 * hidden development / reference set that must not appear in Discover or in
 * "Meine Inhalte".
 */
export function isHiddenSet(source: string, id: string): boolean {
  return HIDDEN_SET_KEYS.has(`${source}::${id}`);
}
