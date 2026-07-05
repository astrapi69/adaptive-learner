/**
 * useCorrectionRoundEnabled (#1376).
 *
 * Live-reads whether the lesson-summary correction round is enabled. Re-reads
 * when the preference changes in this tab (``CORRECTION_ROUND_PREF_CHANGE_EVENT``)
 * or in another tab (native ``storage`` event), so the Settings toggle takes
 * effect without a reload.
 */

import { useEffect, useState } from "react";

import {
  CORRECTION_ROUND_PREF_CHANGE_EVENT,
  readCorrectionRoundEnabled,
} from "../../lib/learning/correctionRoundPref";

export function useCorrectionRoundEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() =>
    readCorrectionRoundEnabled(),
  );

  useEffect(() => {
    const refresh = () => setEnabled(readCorrectionRoundEnabled());
    window.addEventListener(CORRECTION_ROUND_PREF_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    // Pick up any change between the initial useState and the effect mount.
    refresh();
    return () => {
      window.removeEventListener(CORRECTION_ROUND_PREF_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return enabled;
}
