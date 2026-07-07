/**
 * useOrientationReanchor (#1422) — re-anchor the active lesson step after a
 * device rotation.
 *
 * iOS/WebKit is known to leave stale scroll offsets and sticky positioning
 * after an orientation change until the next scroll interaction — desktop
 * engines re-anchor automatically (the #1422 rotation e2e spec is green in
 * Chromium), so this is a device-only hardening. Listening on the
 * ``(orientation: portrait)`` media query (instead of every ``resize``)
 * keeps it inert during ordinary desktop window resizing; the double
 * ``requestAnimationFrame`` lets the post-rotation reflow finish before the
 * anchor is measured. The ``scrollIntoView`` both forces the scroll
 * recompute AND guarantees the task + sticky footer land inside the
 * freshly-sized viewport. Non-smooth (``auto``) scrolling, so
 * ``prefers-reduced-motion`` needs no special-casing.
 *
 * @example
 * const stepScrollRef = useRef<HTMLDivElement>(null);
 * useOrientationReanchor(stepScrollRef, !showResumePrompt);
 *
 * @param anchorRef - The element to bring back to the top of the scrollport
 *   (the lesson page's existing #959 step anchor).
 * @param enabled - Gate, e.g. off while a resume overlay owns the screen.
 */

import { useEffect, type RefObject } from "react";

export function useOrientationReanchor(
  anchorRef: RefObject<HTMLElement | null>,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const orientation = window.matchMedia("(orientation: portrait)");
    // Older engines (and some stubs) only expose addListener; both paths
    // are covered so the hook degrades to a no-op rather than throwing.
    if (typeof orientation.addEventListener !== "function") return;

    const reanchor = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          anchorRef.current?.scrollIntoView?.({ block: "start" });
        });
      });
    };
    orientation.addEventListener("change", reanchor);
    return () => orientation.removeEventListener("change", reanchor);
  }, [anchorRef, enabled]);
}
