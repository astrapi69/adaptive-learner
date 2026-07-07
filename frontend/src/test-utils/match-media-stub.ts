/**
 * Controllable ``window.matchMedia`` stub for Vitest (happy-dom).
 *
 * happy-dom evaluates media queries against a fixed default viewport, so
 * tests that exercise viewport-gated rendering (e.g. the primary-nav
 * hamburger, #1390) stub ``matchMedia`` with an explicit, flippable match
 * state instead. The stub ignores the query string — every query shares the
 * single stubbed state — which is exactly what single-breakpoint component
 * tests need.
 *
 * @example
 * const media = stubMatchMedia(true); // "mobile"
 * // ...render...
 * act(() => media.set(false));        // resize to "desktop"
 * media.restore();
 */

export interface MatchMediaStub {
  /** Flip the match state and notify every ``change`` listener. */
  set(matches: boolean): void;
  /** Number of currently registered ``change`` listeners (leak checks). */
  listenerCount(): number;
  /** Restore the original ``window.matchMedia``. */
  restore(): void;
}

type ChangeListener = (event: MediaQueryListEvent) => void;

export function stubMatchMedia(initialMatches: boolean): MatchMediaStub {
  const original = window.matchMedia;
  let matches = initialMatches;
  const listeners = new Set<ChangeListener>();

  window.matchMedia = ((query: string) =>
    ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: ChangeListener) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: ChangeListener) => {
        listeners.delete(listener);
      },
      addListener: (listener: ChangeListener) => {
        listeners.add(listener);
      },
      removeListener: (listener: ChangeListener) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;

  return {
    set(next: boolean) {
      matches = next;
      for (const listener of [...listeners]) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
    listenerCount() {
      return listeners.size;
    },
    restore() {
      window.matchMedia = original;
    },
  };
}
