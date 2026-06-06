/**
 * Per-repo GitHub token storage (EXP-023 Phase B).
 *
 * Each connected private/coach repo can carry its own read-only token. To
 * keep secrets OUT of the exportable plugin settings (where the repo list
 * lives), tokens are stored separately — one localStorage entry per repo
 * source, mirroring the existing shared-token pattern
 * (``adaptive-learner.github_token``). A repo with no per-repo token falls
 * back to that shared token, so public repos need nothing.
 *
 * This is the browser (Dexie-mode) store. In API mode the shared
 * server-side token (secrets.yaml) remains the fallback; per-repo
 * server-side secrets are a Phase C concern.
 */

const PREFIX = "adaptive-learner.content_repo_token::";
const SHARED_KEY = "adaptive-learner.github_token";

function safeGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** Store (or clear, when blank) the per-repo token for ``source``. */
export function writeRepoToken(source: string, token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) localStorage.setItem(PREFIX + source, trimmed);
    else localStorage.removeItem(PREFIX + source);
  } catch {
    /* storage unavailable (private mode / quota) — token simply not kept */
  }
}

/** Remove the per-repo token for ``source`` (on disconnect). */
export function clearRepoToken(source: string): void {
  try {
    localStorage.removeItem(PREFIX + source);
  } catch {
    /* ignore */
  }
}

/** True when ``source`` has its own stored token (a coach/private repo). */
export function hasRepoToken(source: string): boolean {
  return safeGet(PREFIX + source).length > 0;
}

/**
 * The token to use for ``source``: the per-repo token if present, else the
 * shared GitHub token, else an empty string (public access).
 */
export function resolveRepoToken(source: string): string {
  return safeGet(PREFIX + source) || safeGet(SHARED_KEY);
}
