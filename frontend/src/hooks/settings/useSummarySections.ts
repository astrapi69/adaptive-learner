/**
 * useSummarySections (#1411).
 *
 * Live-reads which lesson-summary sections are enabled. Re-reads when the
 * preference changes in this tab (``SUMMARY_SECTIONS_CHANGE_EVENT``) or in
 * another tab (native ``storage`` event), so the Settings toggles take effect
 * without a reload. Same pattern as the former ``useCorrectionRoundEnabled``
 * (#1376), which this supersedes.
 */

import { useEffect, useState } from "react";

import {
  SUMMARY_SECTIONS_CHANGE_EVENT,
  readSummarySections,
  type SummarySectionsPref,
} from "../../lib/learning/summarySectionsPref";

export function useSummarySections(): SummarySectionsPref {
  const [sections, setSections] = useState<SummarySectionsPref>(() =>
    readSummarySections(),
  );

  useEffect(() => {
    const refresh = () => setSections(readSummarySections());
    window.addEventListener(SUMMARY_SECTIONS_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    // Pick up any change between the initial useState and the effect mount.
    refresh();
    return () => {
      window.removeEventListener(SUMMARY_SECTIONS_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return sections;
}
