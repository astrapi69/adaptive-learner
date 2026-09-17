/**
 * useSettingsAnchorOffset - how far a Settings section anchor must stay
 * clear of the sticky chrome above it (#2961; shared by the Learning and
 * the Data tab since #3122).
 *
 * Two sticky strips can cover the top of the scroll viewport: the app
 * header (``.app-nav``, sticky at every width) and, on ``md+`` only, the
 * section bar itself. ``stickyTop`` is where the bar has to stick (the
 * header height) and ``anchorOffset`` is what a ``scroll-margin-top``
 * needs so a scrolled-to cluster heading lands below both. Measured, not
 * hardcoded: the header height differs per viewport and locale line
 * wrap. Re-measured on resize; zero (plus the gap) where nothing is
 * rendered, which is what happy-dom reports.
 *
 * @example
 * const subNavRef = useRef<HTMLElement>(null);
 * const { stickyTop, anchorOffset } = useSettingsAnchorOffset(subNavRef);
 */

import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

/** Breakpoint at which the section bar becomes sticky (Tailwind ``md``). */
const STICKY_MEDIA_QUERY = "(min-width: 768px)";
/** Breathing room between the sticky chrome and the scrolled-to heading. */
const ANCHOR_GAP_PX = 8;

export interface SettingsAnchorOffset {
  /** Sticky ``top`` for the section bar: the app header height in px. */
  stickyTop: number;
  /** ``scroll-margin-top`` for a cluster anchor in px. */
  anchorOffset: number;
}

function measureHeight(el: Element | null): number {
  return el ? Math.round(el.getBoundingClientRect().height) : 0;
}

function barIsSticky(): boolean {
  return (
    typeof window.matchMedia === "function" && window.matchMedia(STICKY_MEDIA_QUERY).matches
  );
}

function measure(subNav: Element | null): SettingsAnchorOffset {
  const header = measureHeight(document.querySelector(".app-nav"));
  const bar = barIsSticky() ? measureHeight(subNav) : 0;
  return { stickyTop: header, anchorOffset: header + bar + ANCHOR_GAP_PX };
}

export function useSettingsAnchorOffset(
  subNavRef: RefObject<HTMLElement | null>,
): SettingsAnchorOffset {
  const [offset, setOffset] = useState<SettingsAnchorOffset>({
    stickyTop: 0,
    anchorOffset: ANCHOR_GAP_PX,
  });

  useLayoutEffect(() => {
    const update = () => setOffset(measure(subNavRef.current));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [subNavRef]);

  return offset;
}
