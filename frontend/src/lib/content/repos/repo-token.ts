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
 *
 * Public-vs-private weiche (#1429): the official/bundled source is public and
 * MUST resolve NO token, so the CORS-safe fetcher always reads it from
 * ``raw.githubusercontent.com`` (ungedrosselt) instead of forcing the shared
 * PAT onto the ``api.github.com`` contents endpoint (60/h unauthenticated →
 * 401/403, or 401 on an expired PAT). Only a genuinely private/coach repo (its
 * OWN per-repo token, or the shared PAT as its explicit read credential) uses
 * the authenticated contents API.
 */

import { isOfficialSource } from "./source-identity";

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
 *
 * The official/bundled source is public and always resolves an empty string
 * (#1429), so it is read from ``raw`` and never carries the shared PAT onto
 * the throttled ``contents`` API. A per-repo token set directly on the
 * official source is still honoured (an explicit opt-in), but the shared-PAT
 * fallback never applies to it.
 */
export function resolveRepoToken(source: string): string {
  const perRepo = safeGet(PREFIX + source);
  if (perRepo) return perRepo;
  return isOfficialSource(source) ? "" : safeGet(SHARED_KEY);
}
