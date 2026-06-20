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

/** The ISO timestamp of the last accepted update, or ``null`` when never. */
export function readAcceptedAt(): string | null {
  return readKey(ACCEPTED_AT_KEY);
}

/** The version the user last accepted, or ``null`` when never / unknown. */
export function readAcceptedVersion(): string | null {
  return readKey(ACCEPTED_VERSION_KEY);
}

/**
 * Record that the user clicked "Aktualisieren": stamp the current time and the
 * accepted version. ``version`` may be ``null`` (a SW-only update with no known
 * version string) — the timestamp alone then carries the quiet-window
 * suppression.
 *
 * @param version - The version being accepted, or ``null`` when unknown.
 * @param now - Current epoch ms (injectable for tests).
 */
export function recordUpdateAccepted(
  version: string | null,
  now: number = Date.now(),
): void {
  writeKey(ACCEPTED_AT_KEY, new Date(now).toISOString());
  if (version) writeKey(ACCEPTED_VERSION_KEY, version);
}

/**
 * Whether the update banner should be shown for ``newVersion``.
 *
 * Returns ``false`` (suppress) when the user recently accepted an update — within
 * the {@link ACCEPT_QUIET_MS} quiet window, OR for the exact version already
 * accepted. Returns ``true`` otherwise, so a genuinely newer version (after the
 * quiet window) re-offers the banner.
 *
 * @param newVersion - The candidate deployed version, or ``null`` when unknown.
 * @param now - Current epoch ms (injectable for tests).
 */
export function shouldShowUpdateBanner(
  newVersion: string | null,
  now: number = Date.now(),
): boolean {
  const acceptedAt = readAcceptedAt();
  if (acceptedAt) {
    const accepted = Date.parse(acceptedAt);
    if (!Number.isNaN(accepted) && now - accepted < ACCEPT_QUIET_MS) {
      return false; // quiet window — the click was recent, update is in flight
    }
  }

  const acceptedVersion = readAcceptedVersion();
  if (newVersion && acceptedVersion === newVersion) {
    return false; // this exact version was already accepted
  }

  return true;
}
