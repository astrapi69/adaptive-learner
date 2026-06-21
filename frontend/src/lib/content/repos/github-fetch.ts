/**
 * CORS-safe GitHub content fetching for Dexie / GitHub-Pages mode (#645).
 *
 * ``raw.githubusercontent.com`` serves public repo files but does NOT answer
 * CORS preflight requests: any custom request header (an ``Authorization``
 * Bearer token, a non-simple ``Accept``, …) turns a cross-origin ``GET`` into
 * a *preflighted* request, which the raw host rejects — the
 * "blocked by CORS policy: preflight request" error users hit when a GitHub
 * token is configured (the shared token is resolved for every non-bundled
 * source, so even a public repo picks it up).
 *
 * Host selection by auth:
 *  - **No token** (public repos): fetch ``raw.githubusercontent.com`` with NO
 *    custom headers — a "simple" cross-origin request, so the browser sends no
 *    preflight. ``raw`` has no API rate limit.
 *  - **Token** (private / coach repos): fetch the ``api.github.com`` contents
 *    endpoint, which DOES support CORS preflight + ``Authorization``. The
 *    ``application/vnd.github.raw`` media type returns the file bytes verbatim
 *    (same payload the raw host would serve). Authenticated API calls share
 *    GitHub's 5000/h limit, which only private-repo users pay.
 *
 * Retry policy (#645 bug 3): only *transient* failures are retried — a 5xx
 * upstream — with exponential backoff, capped at {@link DEFAULT_RETRIES}. A
 * rejected ``fetch`` (``TypeError: Failed to fetch``) is a CORS or network
 * failure: CORS is permanent (the identical request is rejected every time)
 * and the browser does not let us tell CORS apart from a genuine network drop,
 * so we bias to NOT retrying — a misconfiguration must not spam four identical
 * failures into the console. 4xx / 404 are likewise never retried; the caller
 * inspects ``response.ok`` / ``response.status`` and maps them to a reason.
 */

const RAW_BASE = "https://raw.githubusercontent.com";
const API_BASE = "https://api.github.com";

/** Default max retry count for a transient (5xx) upstream failure. */
export const DEFAULT_RETRIES = 3;

/** Default base delay (ms) for exponential backoff between retries. */
export const DEFAULT_BASE_DELAY_MS = 400;

/** Options for {@link fetchWithRetry}. */
export interface RetryOptions {
  /** Max retries on a transient failure (default {@link DEFAULT_RETRIES}). */
  retries?: number;
  /** Base backoff delay in ms (default {@link DEFAULT_BASE_DELAY_MS}); the
   *  nth retry waits ``base * 2^(n-1)``. Tests pass ``0`` for instant runs. */
  baseDelayMs?: number;
}

interface HttpError extends Error {
  status?: number;
}

function httpError(status: number, path: string): HttpError {
  const err: HttpError = new Error(`Upstream HTTP ${status} for ${path}`);
  err.status = status;
  return err;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True for an HTTP status worth retrying (a transient upstream 5xx). */
export function isTransientStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

/**
 * ``fetch`` wrapper that retries ONLY a transient (5xx) response with
 * exponential backoff. A rejected fetch (CORS / network ``TypeError``) and
 * any 4xx / 404 resolve immediately — those are never transient.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts: RetryOptions = {},
): Promise<Response> {
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  let attempt = 0;
  for (;;) {
    // A rejected fetch (CORS / network ``TypeError``) propagates here
    // unretried: CORS is permanent and indistinguishable from a network drop
    // in the browser, so we bias to not retrying (see the module docstring).
    // Only a resolved-but-transient 5xx below is retried.
    const response = await fetch(url, init);
    if (isTransientStatus(response.status) && attempt < retries) {
      attempt += 1;
      if (baseDelayMs > 0) await sleep(baseDelayMs * 2 ** (attempt - 1));
      continue;
    }
    return response;
  }
}

/**
 * Build the URL + fetch init for one repo file, choosing the host by auth so
 * the request never triggers a CORS preflight the host can't answer.
 *
 * @param source GitHub ``"{owner}/{repo}"`` identifier.
 * @param branch Branch / ref to read from.
 * @param path Repo-relative file path (leading slashes are trimmed).
 * @param token Optional read token; empty string for public access.
 */
export function buildFileRequest(
  source: string,
  branch: string,
  path: string,
  token: string,
): { url: string; init?: RequestInit } {
  const safePath = path.replace(/^\/+/, "");
  const trimmedToken = token.trim();
  if (trimmedToken) {
    const ref = encodeURIComponent(branch);
    return {
      url: `${API_BASE}/repos/${source}/contents/${safePath}?ref=${ref}`,
      init: {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          Accept: "application/vnd.github.raw",
        },
      },
    };
  }
  return { url: `${RAW_BASE}/${source}/${branch}/${safePath}` };
}

/** Fetch a repo text file. Throws an ``HttpError`` (carrying ``status``) on a
 *  non-OK response. */
export async function fetchGitHubFileText(
  source: string,
  branch: string,
  path: string,
  token = "",
): Promise<string> {
  const { url, init } = buildFileRequest(source, branch, path, token);
  const response = await fetchWithRetry(url, init);
  if (!response.ok) throw httpError(response.status, path);
  return response.text();
}

/** Fetch a repo binary file. Returns ``null`` on 404 so a stale manifest
 *  asset entry doesn't fail the whole download; throws on other non-OK. */
export async function fetchGitHubFileBytesOptional(
  source: string,
  branch: string,
  path: string,
  token = "",
): Promise<ArrayBuffer | null> {
  const { url, init } = buildFileRequest(source, branch, path, token);
  const response = await fetchWithRetry(url, init);
  if (response.status === 404) return null;
  if (!response.ok) throw httpError(response.status, path);
  return response.arrayBuffer();
}
