/**
 * useDeferredScroll - scroll to a target that may not have layout yet
 * (#2961; lifted from the Settings key-vault scroll, #1773 / #1831).
 *
 * Settings panels stay mounted but inactive ones carry ``hidden``
 * (``display:none``), so a node in an inactive panel has NO layout and
 * ``scrollIntoView`` is a no-op. A single rAF covers the panel
 * display:none -> visible toggle, but NOT async layout inside the panel
 * (a section above the target resolving its data and changing height
 * pushes the target back out of view). So: retry across a bounded frame
 * window, re-issuing the scroll until the target is actually in the
 * viewport, then report. ``target`` is opaque to the hook - the caller
 * resolves it to an element each frame through ``findTarget`` (``null``
 * while it does not exist yet).
 *
 * @example
 * useDeferredScroll({
 *   active: activeTab === "learning" && pending !== null,
 *   target: pending,
 *   findTarget: (id) => document.getElementById(`learning-${id}`),
 *   onSettled: () => setPending(null),
 *   behavior: prefersReducedMotion() ? "auto" : "smooth",
 * });
 */

import { useEffect, useRef } from "react";

export interface DeferredScrollOptions<T> {
  /** Run the loop only while true (e.g. the owning panel is visible). */
  active: boolean;
  /** What to scroll to; ``null`` idles. A change restarts the loop. */
  target: T | null;
  /** Resolve the target to its element - called every frame, may return ``null``. */
  findTarget: (target: T) => Element | null;
  /** Called once: ``true`` when the target reached the viewport, ``false`` after ``maxFrames``. */
  onSettled: (inView: boolean) => void;
  /** ``scrollIntoView`` alignment. Default ``"start"``. */
  block?: ScrollLogicalPosition;
  /** ``scrollIntoView`` behaviour. Default ``"auto"`` (instant). */
  behavior?: ScrollBehavior;
  /** Frame budget. Default 60 (about 1 s at 60 fps). */
  maxFrames?: number;
}

function isInView(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

/**
 * Bounded rAF retry loop: scroll ``target`` into view until it is, or
 * until the frame budget is spent, then call ``onSettled``.
 */
export function useDeferredScroll<T>({
  active,
  target,
  findTarget,
  onSettled,
  block = "start",
  behavior = "auto",
  maxFrames = 60,
}: DeferredScrollOptions<T>): void {
  // Callbacks and options live in refs so a new identity per render
  // (inline arrows) never restarts a loop that is already in flight.
  const latest = useRef({ findTarget, onSettled, block, behavior, maxFrames });
  latest.current = { findTarget, onSettled, block, behavior, maxFrames };

  useEffect(() => {
    if (!active || target === null) return;
    let raf = 0;
    let frame = 0;
    const tick = () => {
      const { findTarget: find, onSettled: settle, block: b, behavior: bh, maxFrames: max } =
        latest.current;
      const el = find(target);
      if (el && isInView(el)) {
        settle(true);
        return;
      }
      el?.scrollIntoView?.({ block: b, behavior: bh });
      frame += 1;
      if (frame < max) {
        raf = requestAnimationFrame(tick);
      } else {
        settle(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);
}
