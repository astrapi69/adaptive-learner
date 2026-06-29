/**
 * useContentViewMode (#1240).
 *
 * Reactive accessor for the Content browser's grid ⇄ list view mode.
 * Reads the persisted preference (default "grid"), re-renders the
 * consumer when it changes in this tab (custom event) or another
 * (native ``storage`` event), and returns a setter that persists +
 * broadcasts the new value so every subscriber stays in lockstep.
 */

import { useEffect, useState } from "react";

import {
  CONTENT_VIEW_MODE_CHANGE_EVENT,
  CONTENT_VIEW_MODE_KEY,
  readContentViewMode,
  writeContentViewMode,
  type ContentViewMode,
} from "../../lib/content/browse/viewModePref";

/**
 * @returns A ``[mode, setMode]`` tuple. ``setMode`` persists the value
 *   and notifies all subscribers; no reload is needed to switch.
 */
export function useContentViewMode(): [ContentViewMode, (mode: ContentViewMode) => void] {
  const [mode, setModeState] = useState<ContentViewMode>(() => readContentViewMode());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
      return;
    }
    const refresh = () => setModeState(readContentViewMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONTENT_VIEW_MODE_KEY) refresh();
    };
    window.addEventListener(CONTENT_VIEW_MODE_CHANGE_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CONTENT_VIEW_MODE_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setMode = (next: ContentViewMode) => {
    writeContentViewMode(next);
    setModeState(next);
  };

  return [mode, setMode];
}
