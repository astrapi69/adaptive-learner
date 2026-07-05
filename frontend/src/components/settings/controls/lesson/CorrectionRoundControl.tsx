/**
 * CorrectionRoundControl — Settings → Learning toggle for the SRS correction
 * round in the lesson-completion summary (#1376).
 *
 * Default ON. When off, the correction round is not shown after a lesson; the
 * same errors stay reachable through the regular "Fehler wiederholen" / SRS
 * review path. Persists via the localStorage helpers in
 * ``lib/learning/correctionRoundPref`` (same pattern as the hint/feedback
 * controls), so it works in both storage modes.
 */

import { useState } from "react";

import { useI18n } from "../../../../hooks/ui/useI18n";
import {
  readCorrectionRoundEnabled,
  setCorrectionRoundEnabled,
} from "../../../../lib/learning/correctionRoundPref";

export default function CorrectionRoundControl() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(() => readCorrectionRoundEnabled());

  const handleEnabled = (next: boolean) => {
    setEnabled(next);
    setCorrectionRoundEnabled(next);
  };

  return (
    <section
      className="settings-section"
      data-testid="settings-section-correction-round"
    >
      <h2 className="settings-section-title">
        {t("settings.section_correction_round", "Correction round")}
      </h2>
      <label className="form-row form-row-toggle">
        <span className="form-label-stack">
          <span className="form-label">
            {t(
              "settings.correction_round_enabled",
              "Show the correction round after lessons",
            )}
          </span>
          <span className="form-hint">
            {t(
              "settings.correction_round_enabled_desc",
              "At the end of a lesson, offer to fix your mistakes right away. When off, they stay available in the review / \"Practice errors\" mode.",
            )}
          </span>
        </span>
        <input
          type="checkbox"
          data-testid="settings-correction-round-toggle"
          checked={enabled}
          onChange={(e) => handleEnabled(e.target.checked)}
        />
      </label>
    </section>
  );
}
