/**
 * useScrollSpy - which of several page sections the viewport shows (#2966).
 *
 * One ``IntersectionObserver`` over the resolved sections; the active id
 * is the FIRST intersecting section in list order (the topmost one on
 * screen). The observation band runs from ``topOffset`` (the sticky
 * chrome above the content) down to the middle of the viewport, so a
 * section counts as active while its top half of the screen is its own.
 * When nothing intersects (a short last section at the very bottom, a
 * gap between two sections) the last known id is kept rather than
 * flickering to none. Without ``IntersectionObserver`` (happy-dom, old
 * browsers) the hook reports ``null`` and the caller falls back to its
 * own state - the tests install a stub.
 *
 * @example
 * const spied = useScrollSpy(LEARNING_SECTION_IDS, {
 *   enabled: active,
 *   resolve: (id) => document.getElementById(`learning-${id}`),
 *   topOffset: anchorOffset,
 * });
 */

import { useEffect, useState } from "react";

export interface ScrollSpyOptions<T extends string> {
  /** Observe only while true (e.g. the owning panel is visible). */
  enabled: boolean;
  /** Resolve an id to its element; ``null`` skips it. Called when observing starts. */
  resolve: (id: T) => Element | null;
  /** Height of the sticky chrome above the content, in px. Default 0. */
  topOffset?: number;
}

function firstIntersecting<T extends string>(
  ids: readonly T[],
  intersecting: ReadonlySet<Element>,
  targets: ReadonlyMap<Element, T>,
): T | null {
  for (const id of ids) {
    for (const [el, elId] of targets) {
      if (elId === id && intersecting.has(el)) return id;
    }
  }
  return null;
}

export function useScrollSpy<T extends string>(
  ids: readonly T[],
  { enabled, resolve, topOffset = 0 }: ScrollSpyOptions<T>,
): T | null {
  const [active, setActive] = useState<T | null>(null);
  const idsKey = ids.join(",");

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver !== "function") {
      setActive(null);
      return;
    }
    const targets = new Map<Element, T>();
    for (const id of ids) {
      const el = resolve(id);
      if (el) targets.set(el, id);
    }
    const intersecting = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target);
          else intersecting.delete(entry.target);
        }
        const next = firstIntersecting(ids, intersecting, targets);
        if (next !== null) setActive(next);
      },
      { rootMargin: `-${topOffset}px 0px -50% 0px` },
    );
    for (const el of targets.keys()) observer.observe(el);
    return () => observer.disconnect();
    // ``ids`` is read through its joined key; ``resolve`` is looked up at
    // (re)start only, an inline arrow must not restart the observer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idsKey, topOffset]);

  return active;
}
