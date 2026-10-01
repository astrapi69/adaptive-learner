/**
 * Where a review session was started from (#3499).
 *
 * A review launched from a lesson summary carries the lesson path as
 * ``?from=``, so its end screen can offer the way back. The parameter
 * survives a reload (router state would not). Only a lesson route is read
 * back, which keeps the parameter from ever pointing off-app.
 *
 * @example
 * <Link to={reviewHref(setId, location.pathname)} />
 * const backTo = readReviewOrigin(searchParams.get(REVIEW_ORIGIN_PARAM));
 */

export const REVIEW_ORIGIN_PARAM = "from";

const LESSON_ROUTE = /^\/lesson\/[^/\\]+(?:\/[^/\\]+)*$/;

/** ``/review/{setId}``, with ``?from=`` when the caller names its origin. */
export function reviewHref(setId: string, fromPath?: string): string {
  const base = `/review/${encodeURIComponent(setId)}`;
  if (!fromPath) return base;
  return `${base}?${REVIEW_ORIGIN_PARAM}=${encodeURIComponent(fromPath)}`;
}

/** The origin lesson path, or ``null`` when absent or not a lesson route. */
export function readReviewOrigin(raw: string | null): string | null {
  if (!raw || !LESSON_ROUTE.test(raw)) return null;
  return raw;
}
