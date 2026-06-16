/**
 * pwa/version-check — pure helpers for the app-update check (#613).
 *
 * The build emits a static ``version.json`` (``{version, buildHash}``)
 * alongside the bundle. On start the app fetches it with ``cache:
 * "no-store"`` and compares it with the built-in ``__APP_VERSION__`` /
 * ``__BUILD_HASH__`` literals. A mismatch means a newer build is
 * deployed than the one this tab is running.
 *
 * Storage-agnostic and side-effect-free: every function takes its inputs
 * (including the ``fetch`` implementation) so they are trivially testable
 * without a network, a service worker, or a DOM.
 */

/** Shape of the emitted ``version.json``. */
export interface VersionManifest {
  version: string;
  buildHash: string;
}

/** A version string we treat as "unknown" — never triggers an update. */
const UNKNOWN = "unknown";

/**
 * Whether ``latest`` represents a newer build than ``current``.
 *
 * Conservative by design: an empty / missing / ``"unknown"`` latest (a
 * failed or unbuilt manifest) never reports an update, so a transient
 * fetch glitch can't nag the user. A differing, known version OR a
 * differing build hash (same version, new deploy) counts as an update.
 */
export function isUpdateAvailable(
  current: VersionManifest,
  latest: VersionManifest | null,
): boolean {
  if (!latest) return false;
  const latestVersion = (latest.version ?? "").trim();
  if (latestVersion === "" || latestVersion === UNKNOWN) return false;
  if (latestVersion !== current.version) return true;
  // Same semver but a different build hash = a fresh deploy of the same
  // version (e.g. a content/asset rebuild). Only counts when BOTH hashes
  // are known — an unknown hash on either side is not a signal.
  const latestHash = (latest.buildHash ?? "").trim();
  const currentHash = (current.buildHash ?? "").trim();
  if (
    latestHash !== "" &&
    latestHash !== UNKNOWN &&
    currentHash !== "" &&
    currentHash !== UNKNOWN &&
    latestHash !== currentHash
  ) {
    return true;
  }
  return false;
}

/** Narrow an arbitrary parsed JSON value to a VersionManifest. */
export function parseVersionManifest(value: unknown): VersionManifest | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== "string") return null;
  return {
    version: v.version,
    buildHash: typeof v.buildHash === "string" ? v.buildHash : UNKNOWN,
  };
}

/**
 * Fetch + parse the deployed ``version.json``. Returns ``null`` on any
 * failure (offline, 404, malformed) — the caller treats "couldn't check"
 * as "no update", never as an error surfaced to the user.
 *
 * ``fetchImpl`` is injectable for tests; defaults to the global fetch.
 */
export async function fetchLatestVersion(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VersionManifest | null> {
  try {
    const res = await fetchImpl(url, { cache: "no-store" });
    if (!res.ok) return null;
    return parseVersionManifest(await res.json());
  } catch {
    return null;
  }
}
