/**
 * Conversation-analysis loading view (extracted from ImportDetail for
 * the complexity burn-down #419).
 *
 * Shows the staged-progress phase label, the progress bar, an estimate,
 * and a Cancel button while an analysis is running. Returns ``null``
 * when no analysis is in flight.
 */

import { Button } from "@/components/ui/button";
import {
  ANALYSIS_PHASES,
  ANALYSIS_PHASE_FALLBACKS,
  ANALYSIS_PHASE_PROGRESS,
} from "../../lib/content/analysis/analysis-phases";

interface AnalysisLoadingSectionProps {
  analyzing: boolean;
  analysisPhase: number;
  analysisDone: boolean;
  onCancel: () => void;
  t: (key: string, fallback?: string) => string;
}

/** The staged-progress loading panel; null unless analyzing. */
export default function AnalysisLoadingSection({
  analyzing,
  analysisPhase,
  analysisDone,
  onCancel,
  t,
}: AnalysisLoadingSectionProps) {
  if (!analyzing) return null;
  const progressNow = analysisDone ? 100 : ANALYSIS_PHASE_PROGRESS[analysisPhase];

  return (
    <section
      className="analysis-loading"
      data-testid="analysis-loading"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="analysis-loading-phase" data-testid="analysis-phase">
        {analysisDone
          ? t("import.analysis_done", "Done!")
          : t(
              `import.${ANALYSIS_PHASES[analysisPhase]}`,
              ANALYSIS_PHASE_FALLBACKS[analysisPhase],
            )}
      </p>
      <div
        className="analysis-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressNow}
      >
        <div
          className="analysis-progress-fill"
          style={{ width: `${progressNow}%` }}
        />
      </div>
      {!analysisDone && (
        <p className="analysis-loading-estimate">
          {t("import.analysis_estimate", "Analysis takes approximately 15-30 seconds…")}
        </p>
      )}
      {!analysisDone && (
        <Button
          variant="link"
          data-testid="cancel-analysis-button"
          onClick={onCancel}
          type="button"
        >
          {t("import.analysis_cancel", "Cancel")}
        </Button>
      )}
    </section>
  );
}
