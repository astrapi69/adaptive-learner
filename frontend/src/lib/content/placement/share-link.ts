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
