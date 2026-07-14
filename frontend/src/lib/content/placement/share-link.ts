/**
 * Content-repo share links (EXP-023 Phase B).
 *
 * A share link is a deep link into the app's ``/add-repo`` route carrying
 * the repo URL + branch as query params. No token is ever included — only
 * public repos are shareable by link; private/coach repos are handed the
 * token out of band.
 */

import { isOfficialSource, OFFICIAL_SOURCE } from "../repos/source-identity";

export interface ShareLinkInput {
  /** ``owner/repo`` or any GitHub URL the recipient can resolve. */
  url: string;
  branch: string;
  /** Optional set slug (#1572). When present the recipient lands directly on
   *  the set (``/content/set/{set}``) instead of only connecting the repo.
   *  A token is NEVER part of the link — only the public repo coordinates. */
  set?: string;
}

/**
 * Build an absolute ``…/add-repo?url=…&branch=…[&set=…]`` link.
 *
 * ``origin`` + ``basePath`` default to the running app
 * (``window.location.origin`` + Vite ``BASE_URL``) so the link points at
 * the same deployment; both are injectable for tests. The optional ``set``
 * is appended only when non-empty, so a plain repo-share link stays byte
 * identical (backwards compatible).
 */
export function buildAddRepoLink(
  input: ShareLinkInput,
  origin: string = typeof window !== "undefined" ? window.location.origin : "",
  basePath: string = import.meta.env.BASE_URL ?? "/",
): string {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const params = new URLSearchParams({
    url: input.url,
    branch: input.branch || "main",
  });
  if (input.set) params.set("set", input.set);
  return `${origin}${base}add-repo?${params.toString()}`;
}

/** Minimal, storage-agnostic view of a set needed to build its share link. */
export interface ShareableSet {
  /** The cached-set ``source`` (``owner/repo`` or ``bundled:…``). */
  source: string;
  /** The repo branch the set lives on (defaults to ``main``). */
  branch: string;
  /** The set id — the ``set`` slug the recipient opens. */
  id: string;
}

/**
 * Build a per-set share link (#1572): an ``/add-repo`` deep link that opens
 * the given set directly. An official / bundled set maps onto the always-loaded
 * official repo ({@link OFFICIAL_SOURCE}) so the recipient needs no repo added;
 * a user-repo set carries that repo's ``owner/repo`` source verbatim. The link
 * NEVER contains a token — a private repo's recipient supplies their own access
 * out of band (consistent with {@link buildAddRepoLink}).
 */
export function buildSetShareLink(
  set: ShareableSet,
  origin?: string,
  basePath?: string,
): string {
  const url = isOfficialSource(set.source) ? OFFICIAL_SOURCE : set.source;
  return buildAddRepoLink(
    { url, branch: set.branch || "main", set: set.id },
    origin,
    basePath,
  );
}

/** A repo reference extracted from a scanned/uploaded QR code (#1317). */
export interface ParsedAddRepo {
  /** Repo URL (``owner/repo`` or a full GitHub URL). */
  url: string;
  /** Branch, defaulting to ``main``. */
  branch: string;
  /** Optional set slug (#1572) when the link is a per-set share link. */
  set?: string;
}

/**
 * Parse a decoded QR payload into a repo reference (#1317), the inverse of
 * {@link buildAddRepoLink}. Accepts three shapes so an uploaded QR image
 * populates the add-repo form regardless of how it was produced:
 *
 *   1. an ``…/add-repo?url=…&branch=…`` deep link (what the share UI emits),
 *   2. a bare ``add-repo?url=…&branch=…`` fragment, or
 *   3. a plain GitHub repo URL / ``owner/repo`` slug (branch defaults to main).
 *
 * Returns ``null`` when the payload carries no resolvable repo, so the caller
 * can show a "not an add-repo QR" message. Pure + app-agnostic (no network).
 */
export function parseAddRepoQr(decoded: string): ParsedAddRepo | null {
  const raw = (decoded ?? "").trim();
  if (!raw) return null;

  const withSet = (url: string, params: URLSearchParams): ParsedAddRepo => {
    const parsed: ParsedAddRepo = { url, branch: params.get("branch") || "main" };
    const set = params.get("set");
    if (set) parsed.set = set;
    return parsed;
  };

  // 1) Absolute /add-repo deep link.
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.includes("add-repo")) {
      const url = parsed.searchParams.get("url");
      if (url) return withSet(url, parsed.searchParams);
    }
  } catch {
    /* not an absolute URL — fall through */
  }

  // 2) Bare "add-repo?url=…&branch=…" fragment (relative link / raw query).
  const marker = raw.indexOf("add-repo?");
  if (marker !== -1) {
    const params = new URLSearchParams(raw.slice(marker + "add-repo?".length));
    const url = params.get("url");
    if (url) return withSet(url, params);
  }

  // 3) A plain GitHub repo URL or an ``owner/repo`` slug.
  if (/github\.com\/[\w.-]+\/[\w.-]+/i.test(raw) || /^[\w.-]+\/[\w.-]+$/.test(raw)) {
    return { url: raw, branch: "main" };
  }

  return null;
}
