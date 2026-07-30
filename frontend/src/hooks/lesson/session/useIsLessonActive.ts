import {useLocation} from "react-router";

/**
 * True while the user is inside an active learning surface — a
 * lesson playthrough, an SRS review session, or an adaptive
 * lesson. Used to collapse the top navigation into a minimal
 * hamburger-only bar so the lesson content reclaims vertical
 * space (especially on landscape mobile).
 *
 * Route prefixes (project-reference §8):
 *   - /lesson/:setSlug/:setId/:filename
 *   - /review/:setId
 *   - /adaptive-lesson/:setId
 *   - /error-replay/:setSlug/:setId/:filename
 *
 * Prefix-matched (not exact) so the dynamic params don't matter.
 */
export const LESSON_ROUTE_PREFIXES: readonly string[] = [
    "/lesson/",
    "/review/",
    "/adaptive-lesson/",
    "/error-replay/",
];

export function isLessonRoute(pathname: string): boolean {
    return LESSON_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function useIsLessonActive(): boolean {
    const {pathname} = useLocation();
    return isLessonRoute(pathname);
}
