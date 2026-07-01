/**
 * Content-repo share links (EXP-023 Phase B).
 *
 * A share link is a deep link into the app's ``/add-repo`` route carrying
 * the repo URL + branch as query params. No token is ever included — only
 * public repos are shareable by link; private/coach repos are handed the
 * token out of band.
 */

export interface ShareLinkInput {
  /** ``owner/repo`` or any GitHub URL the recipient can resolve. */
  url: string;
  branch: string;
}

/**
 * Build an absolute ``…/add-repo?url=…&branch=…`` link.
 *
 * ``origin`` + ``basePath`` default to the running app
 * (``window.location.origin`` + Vite ``BASE_URL``) so the link points at
 * the same deployment; both are injectable for tests.
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
  return `${origin}${base}add-repo?${params.toString()}`;
}

/** A repo reference extracted from a scanned/uploaded QR code (#1317). */
export interface ParsedAddRepo {
  /** Repo URL (``owner/repo`` or a full GitHub URL). */
  url: string;
  /** Branch, defaulting to ``main``. */
  branch: string;
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

  // 1) Absolute /add-repo deep link.
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.includes("add-repo")) {
      const url = parsed.searchParams.get("url");
      if (url) return { url, branch: parsed.searchParams.get("branch") || "main" };
    }
  } catch {
    /* not an absolute URL — fall through */
  }

  // 2) Bare "add-repo?url=…&branch=…" fragment (relative link / raw query).
  const marker = raw.indexOf("add-repo?");
  if (marker !== -1) {
    const params = new URLSearchParams(raw.slice(marker + "add-repo?".length));
    const url = params.get("url");
    if (url) return { url, branch: params.get("branch") || "main" };
  }

  // 3) A plain GitHub repo URL or an ``owner/repo`` slug.
  if (/github\.com\/[\w.-]+\/[\w.-]+/i.test(raw) || /^[\w.-]+\/[\w.-]+$/.test(raw)) {
    return { url: raw, branch: "main" };
  }

  return null;
}
