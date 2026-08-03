/**
 * useDiscoverSourceLanguage (#1343).
 *
 * Reactive accessor for the Discover source-language filter choice. Reads
 * the persisted EXPLICIT choice (``null`` when unset → caller falls back to
 * the UI-locale default), re-renders the consumer when it changes in this
 * tab (custom event) or another (native ``storage`` event), and returns a
 * setter that persists + broadcasts so every subscriber stays in lockstep.
 */

import { useEffect, useState } from "react";

import {
  DISCOVER_SOURCE_LANGUAGE_CHANGE_EVENT,
  DISCOVER_SOURCE_LANGUAGE_KEY,
  readDiscoverSourceLanguage,
  writeDiscoverSourceLanguage,
} from "../../../lib/content/repos/discoverLanguagePref";

/**
 * @returns A ``[choice, setChoice]`` tuple. ``choice`` is the explicit
 *   stored value or ``null`` when unset (caller applies the locale
 *   default). ``setChoice("")`` stores an explicit "All languages".
 */
export function useDiscoverSourceLanguage(): [
  string | null,
  (choice: string) => void,
] {
  const [choice, setChoiceState] = useState<string | null>(() =>
    readDiscoverSourceLanguage(),
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    ) {
      return;
    }
    const refresh = () => setChoiceState(readDiscoverSourceLanguage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISCOVER_SOURCE_LANGUAGE_KEY) refresh();
    };
    window.addEventListener(DISCOVER_SOURCE_LANGUAGE_CHANGE_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DISCOVER_SOURCE_LANGUAGE_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setChoice = (next: string) => {
    writeDiscoverSourceLanguage(next);
    setChoiceState(next);
  };

  return [choice, setChoice];
}
