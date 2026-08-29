/**
 * Mobile navigation-position preference (#2786).
 *
 * Where the primary navigation sits on the phone: ``"top"`` (the hamburger
 * menu button — the #1512 default and today's behaviour) or ``"bottom"``
 * (the restored EXP-037 {@link ../../components/nav/BottomTabBar} in thumb
 * reach). Desktop is unaffected — the bar is ``md:hidden`` and the top bar
 * always exists.
 *
 * Storage: ``localStorage`` under ``adaptive-learner.nav_position``
 * (absent = ``"top"``). A custom ``adaptive-learner:nav-position-changed``
 * event fires on every setter call so the bar mounts/unmounts live; the
 * standard ``storage`` event covers cross-tab sync. Same pattern as
 * ``useDevMode`` / ``useViewportDiagnostic``. The key rides the `.alb`
 * backup's localStorage snapshot automatically (#2053 pin in
 * ``localStorageSnapshot.test.ts``).
 *
 * @example
 * const position = useNavPosition(); // "top" | "bottom"
 * setNavPosition("bottom"); // tab bar appears at once
 */

import {useEffect, useState} from "react";

const STORAGE_KEY = "adaptive-learner.nav_position";
const EVENT_NAME = "adaptive-learner:nav-position-changed";

/** The two mobile nav placements. */
export type NavPosition = "top" | "bottom";

function readPreference(): NavPosition {
  if (typeof localStorage === "undefined") return "top";
  try {
    return localStorage.getItem(STORAGE_KEY) === "bottom" ? "bottom" : "top";
  } catch {
    return "top";
  }
}

/**
 * Hook returning the current mobile nav position; re-renders the consumer
 * whenever the Settings choice changes, in this tab or another.
 */
export function useNavPosition(): NavPosition {
  const [position, setPosition] = useState<NavPosition>(() => readPreference());

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    ) {
      return;
    }
    const handler = () => setPosition(readPreference());
    window.addEventListener(EVENT_NAME, handler);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPosition(readPreference());
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  return position;
}

/** Imperative setter for the Settings control (top stays the default). */
export function setNavPosition(value: NavPosition): void {
  try {
    if (value === "bottom") localStorage.setItem(STORAGE_KEY, "bottom");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage unavailable — best effort */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, {detail: {value}}));
  }
}
