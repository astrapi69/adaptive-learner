/**
 * Per-repo GitHub token storage (EXP-023 Phase B).
 *
 * Each connected private/coach repo can carry its own read-only token. To
 * keep secrets OUT of the exportable plugin settings (where the repo list
 * lives), tokens are stored separately — one localStorage entry per repo
 * source. A repo with no per-repo token is treated as public.
 *
 * This is the browser (Dexie-mode) store. In API mode the shared
 * server-side token (secrets.yaml) is the authoring credential; per-repo
 * server-side secrets are a Phase C concern.
 *
 * Public-vs-private weiche (#1429/#1438): the weiche is by repo TYPE, not by
 * "is any token configured". Only a repo with its OWN per-repo token (a
 * private/coach repo) resolves a token and reads via the authenticated
 * ``api.github.com`` contents endpoint. Everything without a per-repo token —
 * the official/bundled source AND public user repos — resolves NO token, so
 * the CORS-safe fetcher reads from ``raw.githubusercontent.com`` (ungedrosselt,
 * no preflight). The shared ``adaptive-learner.github_token`` is the
 * community-PR authoring credential ONLY; it is never a content-read fallback,
 * so it can no longer be forced onto a public repo's ``contents`` endpoint
 * (60/h unauthenticated → 401/403, or 401 on an expired PAT).
 */

const PREFIX = "adaptive-learner.content_repo_token::";

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
 * The read token to use for ``source``: its own per-repo token if present,
 * else an empty string (public access → ``raw``).
 *
 * The weiche is by repo TYPE, not by "is any token configured" (#1429/#1438):
 * a private/coach repo carries its OWN per-repo token (entered in the add
 * form, or embedded in the invitation code — {@link writeRepoToken}) and reads
 * via the authenticated ``contents`` API. Everything without a per-repo token
 * — the official/bundled source AND public user repos alike — resolves an
 * empty string and reads from ``raw`` (ungedrosselt, no CORS preflight).
 *
 * The shared ``adaptive-learner.github_token`` is the community-PR *authoring*
 * credential (consumed directly by ``github-api.ts``); it is deliberately NOT
 * a content-READ fallback. Falling it onto a public user repo forced that repo
 * onto the throttled ``contents`` endpoint (60/h unauthenticated → 401/403, or
 * 401 on an expired PAT) — the "Access denied" seen when adding a public repo
 * (#1438). Private repos never depend on it: they always carry a per-repo
 * token, so dropping the fallback loses no legitimate access.
 */
export function resolveRepoToken(source: string): string {
  return safeGet(PREFIX + source);
}
