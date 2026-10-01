import { useLayoutEffect, type RefObject } from "react";

/**
 * Scroll a horizontal strip to its end whenever ``key`` changes (#3400).
 *
 * A time strip (weeks oldest to newest) in an ``overflow-x: auto`` box opens
 * scrolled to the left, so a phone shows the oldest weeks and hides today.
 * Runs before paint, so the strip never flashes its start.
 *
 * @example
 * const ref = useRef<HTMLDivElement>(null);
 * useScrollToEnd(ref, entries);
 */
export function useScrollToEnd(
  ref: RefObject<Pick<HTMLElement, "scrollLeft" | "scrollWidth"> | null>,
  key: unknown,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [ref, key]);
}
