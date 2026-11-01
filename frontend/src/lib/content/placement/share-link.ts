/**
 * Content-repo share links (EXP-023 Phase B, #3819).
 *
 * Two shapes. A set the recipient can resolve by its id alone (an official
 * set, or one the registry lists) gets the short link ``/content/set/<id>``.
 * Anything else gets a deep link into the ``/add-repo`` route carrying the
 * repo and, when it is not ``main``, the branch. No token is ever included:
 * only public repos are shareable by link; private/coach repos are handed
 * the token out of band.
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

/** The running app's origin + base path, normalised to end in ``/``. */
function appRoot(origin: string, basePath: string): string {
  return `${origin}${basePath.endsWith("/") ? basePath : `${basePath}/`}`;
}

/** Encode a query value, keeping ``/`` readable (it is legal in a query). */
function queryValue(value: string): string {
  return encodeURIComponent(value).replace(/%2F/gi, "/");
}

/** The running app's origin, read per call (not at import). */
function defaultOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** The running app's base path (Vite ``BASE_URL``). */
function defaultBase(): string {
  return import.meta.env.BASE_URL ?? "/";
}

/**
 * Build an absolute ``…/add-repo?repo=…[&branch=…][&set=…]`` link.
 *
 * ``origin`` + ``basePath`` default to the running app
 * (``window.location.origin`` + Vite ``BASE_URL``) so the link points at
 * the same deployment; both are injectable for tests. ``branch`` is left
 * out when it is ``main`` (or empty) and ``set`` when it is empty (#3819).
 * The ``/add-repo`` page still reads the ``url`` param of older links.
 */
export function buildAddRepoLink(
  input: ShareLinkInput,
  origin: string = defaultOrigin(),
  basePath: string = defaultBase(),
): string {
  const params: string[] = [`repo=${queryValue(input.url)}`];
  if (input.branch && input.branch !== "main") params.push(`branch=${queryValue(input.branch)}`);
  if (input.set) params.push(`set=${queryValue(input.set)}`);
  return `${appRoot(origin, basePath)}add-repo?${params.join("&")}`;
}

/**
 * Build the short set link ``…/content/set/<id>`` (#3819). It opens the set
 * for anyone whose app can resolve the id: an official set, or a set the
 * registry lists (the page then offers to add its repo).
 */
export function buildSetLink(
  setId: string,
  origin: string = defaultOrigin(),
  basePath: string = defaultBase(),
): string {
  return `${appRoot(origin, basePath)}content/set/${encodeURIComponent(setId)}`;
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
 * Build a per-set share link (#1572, #3819). ``short`` says whether the
 * recipient can resolve the set by its id alone (decided by
 * ``resolveSetShareLink``); then the link is {@link buildSetLink}.
 * Otherwise it is an ``/add-repo`` deep link that opens the set: an
 * official / bundled set maps onto the always-loaded official repo
 * ({@link OFFICIAL_SOURCE}), a user-repo set carries that repo's
 * ``owner/repo`` source verbatim. The link NEVER contains a token.
 */
export function buildSetShareLink(
  set: ShareableSet,
  { short }: { short: boolean },
  origin?: string,
  basePath?: string,
): string {
  if (short) return buildSetLink(set.id, origin, basePath);
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
 *   1. an ``…/add-repo?repo=…&branch=…`` deep link (what the share UI emits;
 *      links shared before #3819 carry ``url=`` instead of ``repo=``),
 *   2. a bare ``add-repo?repo=…&branch=…`` fragment, or
 *   3. a plain GitHub repo URL / ``owner/repo`` slug (branch defaults to main).
 *
 * Returns ``null`` when the payload carries no resolvable repo, so the caller
 * can show a "not an add-repo QR" message. Pure + app-agnostic (no network).
 */
export function parseAddRepoQr(decoded: string): ParsedAddRepo | null {
  const raw = (decoded ?? "").trim();
  if (!raw) return null;

  const repoParam = (params: URLSearchParams): string | null =>
    params.get("repo") || params.get("url");
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
      const url = repoParam(parsed.searchParams);
      if (url) return withSet(url, parsed.searchParams);
    }
  } catch {
    /* not an absolute URL — fall through */
  }

  // 2) Bare "add-repo?url=…&branch=…" fragment (relative link / raw query).
  const marker = raw.indexOf("add-repo?");
  if (marker !== -1) {
    const params = new URLSearchParams(raw.slice(marker + "add-repo?".length));
    const url = repoParam(params);
    if (url) return withSet(url, params);
  }

  // 3) A plain GitHub repo URL or an ``owner/repo`` slug.
  if (/github\.com\/[\w.-]+\/[\w.-]+/i.test(raw) || /^[\w.-]+\/[\w.-]+$/.test(raw)) {
    return { url: raw, branch: "main" };
  }

  return null;
}
