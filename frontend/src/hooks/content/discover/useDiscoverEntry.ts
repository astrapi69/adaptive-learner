/**
 * useDiscoverEntry (EXP-048 #2331).
 *
 * Reactive accessor for the Discover entry-point preset. Reads the persisted
 * EXPLICIT choice (``null`` when unset → caller falls back to the default
 * entry "language"), re-renders on same-tab (custom event) or cross-tab
 * (native ``storage`` event) changes, and returns a setter that persists +
 * broadcasts so every subscriber stays in lockstep. Mirrors
 * {@link useDiscoverSourceLanguage}.
 */

import { useEffect, useState } from "react";

import {
  DISCOVER_ENTRY_CHANGE_EVENT,
  DISCOVER_ENTRY_KEY,
  readDiscoverEntry,
  writeDiscoverEntry,
} from "../../../lib/content/repos/discoverEntryPref";

/**
 * @returns A ``[choice, setChoice]`` tuple. ``choice`` is the explicit stored
 *   value or ``null`` when unset (caller applies the default "language").
 *   ``setChoice("")`` stores an explicit "Alles".
 */
export function useDiscoverEntry(): [string | null, (choice: string) => void] {
  const [choice, setChoiceState] = useState<string | null>(() =>
    readDiscoverEntry(),
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    ) {
      return;
    }
    const refresh = () => setChoiceState(readDiscoverEntry());
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISCOVER_ENTRY_KEY) refresh();
    };
    window.addEventListener(DISCOVER_ENTRY_CHANGE_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DISCOVER_ENTRY_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setChoice = (next: string) => {
    writeDiscoverEntry(next);
    setChoiceState(next);
  };

  return [choice, setChoice];
}
