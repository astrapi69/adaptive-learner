/**
 * useSourceLanguages (Phase 60 / v1.44.0).
 *
 * Resolves the learner's active source languages for the Content
 * Browser: the app language (Settings > Language) first, then any
 * additional source languages they opted into. Re-reads live when
 * the preference changes in this tab (custom event) or another
 * (native ``storage`` event).
 */

import { useEffect, useState } from "react";

import { useI18n } from "./useI18n";
import {
  readAdditionalSourceLanguages,
  SOURCE_LANGUAGES_CHANGE_EVENT,
} from "../lib/content/sourceLanguagePref";

export interface SourceLanguages {
  /** Base subtag of the app language ("de", "en", ...). */
  primary: string;
  /** Opted-in extra source languages (base subtags), excluding
   *  the primary. */
  additional: string[];
  /** primary + additional, deduped, primary first — the order the
   *  Content Browser uses to rank source-language groups. */
  active: string[];
}

export function useSourceLanguages(): SourceLanguages {
  const { lang } = useI18n();
  const primary = (lang || "en").split("-")[0].toLowerCase();
  const [additional, setAdditional] = useState<string[]>(() =>
    readAdditionalSourceLanguages(),
  );

  useEffect(() => {
    const refresh = () => setAdditional(readAdditionalSourceLanguages());
    window.addEventListener(SOURCE_LANGUAGES_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SOURCE_LANGUAGES_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const extras = additional.filter((c) => c !== primary);
  return {
    primary,
    additional: extras,
    active: [primary, ...extras],
  };
}
