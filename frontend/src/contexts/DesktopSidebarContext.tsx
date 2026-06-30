/**
 * Desktop sidebar open/close context (#1260).
 *
 * Holds the runtime open/closed state of the vertical desktop sidebar
 * (#891, {@link DesktopSidebar}) and shares it between the two affordances
 * that drive ONE mechanism: the top bar's "open" toggle (shown while the
 * sidebar is collapsed) and the sidebar's own "close" toggle. Mounting it
 * once at the app root keeps the two in lockstep without prop-drilling.
 *
 * Two actions, deliberately distinct:
 * - ``toggle`` — the explicit user action (clicking either toggle). It
 *   flips the state AND persists the choice to ``localStorage`` so the
 *   user's preference survives a reload (default: open on wide screens).
 * - ``collapse`` — the transient drawer close fired by navigation, an
 *   outside-click, or Escape. It only collapses for the current view and
 *   does NOT persist, so a reload restores the last DELIBERATE preference
 *   rather than the incidental collapsed state after a link tap.
 *
 * The toggle only governs the ``>= lg`` (1024px) sidebar mode; the #891
 * breakpoint logic (tablet top bar, mobile bottom-tab-bar) is untouched.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "adaptive-learner.desktop_sidebar_open";

/** Read the persisted preference. Defaults to open (``true``). */
function readPersisted(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

interface DesktopSidebarContextValue {
  /** Whether the desktop sidebar is currently open. */
  open: boolean;
  /** Explicit user toggle — flips and PERSISTS the choice. */
  toggle: () => void;
  /** Transient close (navigation / outside-click / Escape) — no persist. */
  collapse: () => void;
}

const DesktopSidebarContext = createContext<DesktopSidebarContextValue | null>(
  null,
);

export function DesktopSidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<boolean>(() => readPersisted());

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
      } catch {
        /* localStorage unavailable — best effort */
      }
      return next;
    });
  }, []);

  const collapse = useCallback(() => setOpen(false), []);

  const value = useMemo<DesktopSidebarContextValue>(
    () => ({ open, toggle, collapse }),
    [open, toggle, collapse],
  );

  return (
    <DesktopSidebarContext.Provider value={value}>
      {children}
    </DesktopSidebarContext.Provider>
  );
}

/**
 * Access the desktop-sidebar controls. Falls back to a usable no-op shape
 * (defaulting to the persisted/open value) when no provider is mounted, so
 * isolated unit tests can render the nav components without the provider.
 */
export function useDesktopSidebar(): DesktopSidebarContextValue {
  const ctx = useContext(DesktopSidebarContext);
  if (ctx) return ctx;
  return {
    open: readPersisted(),
    toggle: () => {
      /* no-op fallback (no provider mounted) */
    },
    collapse: () => {
      /* no-op fallback */
    },
  };
}
