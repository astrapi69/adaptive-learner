/**
 * Desktop (API-mode) update checker via the GitHub Releases API (#840).
 *
 * Desktop users run the app from a backend (API mode) where no service
 * worker exists, so the PWA's SW-based "check for updates" never fires for
 * them. This module checks the public GitHub "latest release" endpoint
 * (no token, public repo, 60 req/h unauthenticated) and compares the tag
 * with the running build.
 *
 * {@link checkForUpdateUnified} is the single entry point the UI calls: in
 * Dexie/PWA mode it delegates to the EXISTING service-worker check
 * (unchanged); in API/desktop mode it uses the GitHub path here. The two
 * paths are fully independent.
 *
 * Library-first: native ``fetch`` + a tiny semver compare, no new package.
 */

import { resolveStorageMode } from "../../storage";
import { checkForUpdate as checkSwUpdate, CURRENT_BUILD } from "../pwa/sw-update";

/** Outcome of an update check (mode-independent shape). */
export interface UpdateCheckResult {
  status: "up-to-date" | "update-available" | "error";
  /** The build this app is running (bare, no leading ``v``). */
  currentVersion: string;
  /** The latest available version (bare), when known. */
  latestVersion?: string;
  /** GitHub release page URL (API mode only). */
  releaseUrl?: string;
  /** Release notes Markdown (API mode only). */
  releaseNotes?: string;
  /** ISO publish timestamp (API mode only). */
  publishedAt?: string;
}

/** Public "latest release" endpoint — no token needed for a public repo. */
export const RELEASES_LATEST_URL =
  "https://api.github.com/repos/astrapi69/adaptive-learner/releases/latest";

/** Strip a leading ``v`` so ``v1.89.0`` and ``1.89.0`` compare equal. */
function bare(version: string): string {
  return version.replace(/^v/i, "").trim();
}

/**
 * Compare two semver-ish strings. Returns 1 when ``a`` > ``b``, -1 when
 * ``a`` < ``b``, 0 when equal. A leading ``v`` and missing patch segments
 * are tolerated (``2.0`` === ``2.0.0``).
 */
export function compareVersions(a: string, b: string): number {
  const pa = bare(a).split(".").map(Number);
  const pb = bare(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const ai = pa[i] || 0;
    const bi = pb[i] || 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

/** Minimal shape of the GitHub "latest release" payload we read. */
interface GithubRelease {
  tag_name?: string;
  html_url?: string;
  body?: string;
  published_at?: string;
}

/**
 * Check the GitHub latest release against ``currentVersion`` (API mode).
 *
 * Never throws: a network/HTTP/parse failure resolves to ``status:
 * "error"`` so the caller can show a friendly message.
 *
 * @param currentVersion - The running build (e.g. ``__APP_VERSION__``).
 * @param fetchImpl - Injectable fetch for tests.
 */
export async function checkForUpdate(
  currentVersion: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UpdateCheckResult> {
  const current = bare(currentVersion);
  try {
    const response = await fetchImpl(RELEASES_LATEST_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) {
      return { status: "error", currentVersion: current };
    }
    const release = (await response.json()) as GithubRelease;
    const tag = release.tag_name;
    if (!tag) {
      return { status: "error", currentVersion: current };
    }
    const latest = bare(tag);
    if (compareVersions(latest, current) > 0) {
      return {
        status: "update-available",
        currentVersion: current,
        latestVersion: latest,
        releaseUrl: release.html_url,
        releaseNotes: release.body ?? "",
        publishedAt: release.published_at,
      };
    }
    return { status: "up-to-date", currentVersion: current, latestVersion: latest };
  } catch {
    return { status: "error", currentVersion: current };
  }
}

/**
 * Whether a result should raise the update banner: an update is available,
 * has a version, and that version is not the one the user dismissed (so a
 * dismissed update never nags again, but a NEWER one does).
 */
export function shouldNotifyForUpdate(
  result: UpdateCheckResult,
  dismissedVersion: string | null,
): boolean {
  return (
    result.status === "update-available" &&
    !!result.latestVersion &&
    result.latestVersion !== dismissedVersion
  );
}

/**
 * Mode-aware update check. Dexie/PWA delegates to the existing service-
 * worker check (unchanged); API/desktop uses the GitHub Releases path.
 *
 * @param fetchImpl - Injectable fetch for the GitHub path (tests).
 */
export async function checkForUpdateUnified(
  fetchImpl: typeof fetch = fetch,
): Promise<UpdateCheckResult> {
  if (resolveStorageMode() === "dexie") {
    const outcome = await checkSwUpdate();
    const status: UpdateCheckResult["status"] =
      outcome.status === "available"
        ? "update-available"
        : outcome.status === "current"
          ? "up-to-date"
          : "error";
    return {
      status,
      currentVersion: bare(CURRENT_BUILD.version),
      latestVersion: outcome.latestVersion ? bare(outcome.latestVersion) : undefined,
    };
  }
  return checkForUpdate(CURRENT_BUILD.version, fetchImpl);
}
