/**
 * useMediaQuery — subscribe a component to a CSS media query (#1390).
 *
 * Thin ``useSyncExternalStore`` wrapper over the native
 * ``window.matchMedia`` (implementation hierarchy stage 1 — no library).
 * Re-renders when the query's match state flips, so components can gate
 * RENDERING (element in/out of the DOM) on the same breakpoints the
 * stylesheet uses, instead of merely CSS-hiding focusable markup.
 *
 * Returns ``false`` when ``matchMedia`` is unavailable (non-browser test
 * environments without a stub).
 *
 * @param query - media query string, e.g. ``"(max-width: 768px)"``.
 *
 * @example
 * const isCompact = useMediaQuery("(max-width: 768px)");
 * return isCompact ? <Hamburger /> : <InlineLinks />;
 */

import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onStoreChange);
      return () => mediaQueryList.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
