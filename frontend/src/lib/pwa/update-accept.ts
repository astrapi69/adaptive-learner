/**
 * pwa/update-accept — persists the user's "I clicked Aktualisieren" decision so
 * the PWA update banner ({@link useAppUpdate}) can never re-nag after the user
 * has accepted an update (#846).
 *
 * This is deliberately a SEPARATE mechanism from the Later/X dismiss
 * (``dismissed_version`` in ``updatePrefs.ts``). The two encode different intent:
 *
 *  - **dismissed** ("Später" / X) — "I don't want this right now." The banner is
 *    re-offered on the next app start, and for a newer version.
 *  - **accepted** (this module) — "I clicked Aktualisieren, the update is running,
 *    stop nagging me." The banner stays suppressed for a quiet window AND for the
 *    exact version that was accepted, so a stale reload (no waiting SW → old
 *    precache served, ``version.json`` still newer) cannot make it reappear.
 *
 * Storage-agnostic, never throws (private-mode-safe), and every reader takes an
 * injectable ``now`` so the time logic is trivially testable.
 */

/** ISO timestamp of the last accepted update. */
export const ACCEPTED_AT_KEY = "adaptive-learner.update.last_accepted_at";
/** The version string the user accepted (banner stays hidden for it). */
export const ACCEPTED_VERSION_KEY = "adaptive-learner.update.accepted_version";
/**
 * The build hash the user accepted (#1382). On the Latest strand the version
 * string never changes between deploys — only the hash moves — so a purely
 * version-keyed suppression muted the banner FOREVER after one accepted
 * update. With the hash recorded, a same-version deploy with a NEWER hash
 * re-offers the banner once the quiet window has passed.
 */
export const ACCEPTED_HASH_KEY = "adaptive-learner.update.accepted_hash";
/**
 * sessionStorage flag: set the instant the user clicks "Aktualisieren". This is
 * the HARD in-session guard (#845) — once set, the banner stays suppressed for
 * the rest of the browser session no matter what (survives reloads, independent
 * of any version comparison or timestamp parsing). It is the belt to the
 * localStorage quiet-window suspenders: even if the version is unknown, the
 * clock is wrong, or a stale reload re-reports the same "new" version, the
 * banner cannot re-nag within the session the click happened in.
 */
export const ACCEPTED_SESSION_KEY = "adaptive-learner.update.accepted_session";

/** How long the banner stays quiet after a click, regardless of version. */
export const ACCEPT_QUIET_MS = 60 * 60 * 1000; // 1 hour

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* localStorage unavailable (private mode) — non-fatal */
  }
}

/** Whether the user accepted an update earlier in THIS browser session. */
export function readAcceptedThisSession(): boolean {
  try {
    return sessionStorage.getItem(ACCEPTED_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

function markAcceptedThisSession(): void {
  try {
    sessionStorage.setItem(ACCEPTED_SESSION_KEY, "true");
  } catch {
    /* sessionStorage unavailable — the localStorage quiet window still covers it */
  }
}

/** The ISO timestamp of the last accepted update, or ``null`` when never. */
export function readAcceptedAt(): string | null {
  return readKey(ACCEPTED_AT_KEY);
}

/** The version the user last accepted, or ``null`` when never / unknown. */
export function readAcceptedVersion(): string | null {
  return readKey(ACCEPTED_VERSION_KEY);
}

/** The build hash the user last accepted, or ``null`` when never / unknown. */
export function readAcceptedHash(): string | null {
  return readKey(ACCEPTED_HASH_KEY);
}

/**
 * Record that the user clicked "Aktualisieren": stamp the current time, the
 * accepted version, and the accepted build hash (#1382). ``version`` /
 * ``hash`` may be ``null`` (a SW-only update with no known manifest) — the
 * timestamp alone then carries the quiet-window suppression.
 *
 * @param version - The version being accepted, or ``null`` when unknown.
 * @param hash - The build hash being accepted, or ``null`` when unknown.
 * @param now - Current epoch ms (injectable for tests).
 */
export function recordUpdateAccepted(
  version: string | null,
  hash: string | null = null,
  now: number = Date.now(),
): void {
  // Hard in-session guard first: even if both localStorage writes below fail
  // (private mode), the banner stays suppressed for the rest of the session.
  markAcceptedThisSession();
  writeKey(ACCEPTED_AT_KEY, new Date(now).toISOString());
  if (version) writeKey(ACCEPTED_VERSION_KEY, version);
  if (hash) writeKey(ACCEPTED_HASH_KEY, hash);
}

/**
 * Whether the update banner should be shown for ``newVersion`` / ``newHash``.
 *
 * Returns ``false`` (suppress) when the user recently accepted an update — within
 * the {@link ACCEPT_QUIET_MS} quiet window, OR for the exact BUILD already
 * accepted. Returns ``true`` otherwise, so a genuinely newer build (after the
 * quiet window) re-offers the banner.
 *
 * "Exact build" is version + hash (#1382): when both the candidate's and the
 * accepted hash are known and DIFFER, the deploy is a newer build of the same
 * version (the Latest strand) and the banner comes back. When either hash is
 * unknown the check conservatively falls back to the version-only rule, so
 * pre-#1382 acceptances and hash-less manifests keep their suppression.
 *
 * @param newVersion - The candidate deployed version, or ``null`` when unknown.
 * @param newHash - The candidate deployed build hash, or ``null`` when unknown.
 * @param now - Current epoch ms (injectable for tests).
 */
export function shouldShowUpdateBanner(
  newVersion: string | null,
  newHash: string | null = null,
  now: number = Date.now(),
): boolean {
  // Hard in-session guard: once the user clicked "Aktualisieren" this session,
  // never re-offer the banner until the next browser session (#845). This
  // closes the re-nag loop regardless of version/timestamp edge cases.
  if (readAcceptedThisSession()) return false;

  const acceptedAt = readAcceptedAt();
  if (acceptedAt) {
    const accepted = Date.parse(acceptedAt);
    if (!Number.isNaN(accepted) && now - accepted < ACCEPT_QUIET_MS) {
      return false; // quiet window — the click was recent, update is in flight
    }
  }

  const acceptedVersion = readAcceptedVersion();
  if (newVersion && acceptedVersion === newVersion) {
    const acceptedHash = readAcceptedHash();
    if (newHash && acceptedHash && acceptedHash !== newHash) {
      return true; // same version but a NEWER build hash — a fresh Latest deploy
    }
    return false; // this exact build was already accepted
  }

  return true;
}
