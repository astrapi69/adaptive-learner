/**
 * Viewport-diagnostics preference (#2782).
 *
 * Whether the ``ViewportDiagnostic`` tap-offset probe (#1569/#2340) is
 * enabled. Off by default. Two equivalent activation paths share ONE
 * localStorage flag (``adaptive-learner.vv_diag``):
 *
 *   - the Settings toggle (Settings > General > Diagnostics), via
 *     {@link setViewportDiagnosticEnabled};
 *   - the ``?vvdiag=1`` URL parameter (handled by
 *     ``viewportDiagnosticEnabled`` in the overlay component, which
 *     persists into the same flag; ``?vvdiag=0`` clears it).
 *
 * Updates: a custom ``adaptive-learner:vv-diag-changed`` event fires on
 * every {@link setViewportDiagnosticEnabled} call so the overlay mounts /
 * unmounts immediately — no reload needed. The standard ``storage`` event
 * covers cross-tab sync. Same pattern as ``useDevMode``.
 *
 * @example
 * const probeOn = useViewportDiagnostic();
 * setViewportDiagnosticEnabled(true); // overlay appears at once
 */

import {useEffect, useState} from "react";

const STORAGE_KEY = "adaptive-learner.vv_diag";
const EVENT_NAME = "adaptive-learner:vv-diag-changed";

function readPreference(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Synchronous module-level read for non-React contexts. */
export function isViewportDiagnosticEnabled(): boolean {
  return readPreference();
}

/**
 * Hook returning whether the probe is enabled; re-renders the consumer
 * when the Settings toggle (or another tab) flips the preference.
 */
export function useViewportDiagnostic(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => readPreference());

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    ) {
      return;
    }
    const handler = () => setEnabled(readPreference());
    window.addEventListener(EVENT_NAME, handler);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabled(readPreference());
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  return enabled;
}

/**
 * Imperative setter for the Settings toggle: persists the flag (the same
 * one ``?vvdiag=1`` writes) and dispatches the change event so the
 * overlay reacts without a reload.
 */
export function setViewportDiagnosticEnabled(value: boolean): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage unavailable — best effort */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, {detail: {value}}));
  }
}

/* ------------------------------------------------------------------ *
 * Panel visibility (#2785): the probe's RECORDING and its on-screen
 * measurement bar are independent switches. With the bar hidden the
 * probe keeps appending to the persistent protocol invisibly, and the
 * header/menu stay fully reachable. Default: visible.
 * ------------------------------------------------------------------ */

const PANEL_KEY = "adaptive-learner.vv_diag_panel";
const PANEL_EVENT = "adaptive-learner:vv-panel-changed";

function readPanelPreference(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    return localStorage.getItem(PANEL_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * Hook returning whether the measurement bar is shown while the probe
 * is enabled (#2785). Defaults to true; re-renders on toggle.
 */
export function useVvPanelVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(() => readPanelPreference());

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    ) {
      return;
    }
    const handler = () => setVisible(readPanelPreference());
    window.addEventListener(PANEL_EVENT, handler);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === PANEL_KEY) setVisible(readPanelPreference());
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(PANEL_EVENT, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  return visible;
}

/** Imperative setter for the panel-visibility Settings toggle (#2785). */
export function setVvPanelVisible(value: boolean): void {
  try {
    if (value) localStorage.removeItem(PANEL_KEY);
    else localStorage.setItem(PANEL_KEY, "0");
  } catch {
    /* localStorage unavailable — best effort */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PANEL_EVENT, {detail: {value}}));
  }
}
