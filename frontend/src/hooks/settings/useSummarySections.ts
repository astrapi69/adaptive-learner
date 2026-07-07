/**
 * useSummarySections (#1426, generalises #1411).
 *
 * Live-reads the ordered lesson-summary sections config (which sections are
 * shown AND in which order). Re-reads when the preference changes in this tab
 * (``SUMMARY_SECTIONS_CHANGE_EVENT``) or in another tab (native ``storage``
 * event), so the Settings reorder / toggles take effect without a reload.
 */

import { useEffect, useState } from "react";

import {
  SUMMARY_SECTIONS_CHANGE_EVENT,
  readSummarySections,
  type SummarySectionsConfig,
} from "../../lib/learning/summarySectionsPref";

export function useSummarySections(): SummarySectionsConfig {
  const [sections, setSections] = useState<SummarySectionsConfig>(() =>
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
