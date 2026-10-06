/**
 * The "Corrected" / "Still open" status of one mistake of a lesson run
 * (#3575), shared by the correction summary, the answers overview and
 * "Why you missed these" so every view marks a mistake the same way.
 *
 * @example
 * <CorrectionMark corrected testId="lesson-summary-breakdown-correction-s1" t={t} />
 */

import { CheckCircle2, CircleDashed } from "lucide-react";

export interface CorrectionMarkProps {
  corrected: boolean;
  testId?: string;
  t: (key: string, fallback?: string) => string;
}

/** An icon plus "Corrected" or "Still open". */
export default function CorrectionMark({ corrected, testId, t }: CorrectionMarkProps) {
  const Icon = corrected ? CheckCircle2 : CircleDashed;
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-sm " +
        (corrected ? "text-[var(--success)]" : "text-[var(--error)]")
      }
      data-testid={testId}
      data-corrected={String(corrected)}
    >
      <Icon size={16} aria-hidden="true" />
      {corrected
        ? t("lesson.correction.status_corrected", "Corrected")
        : t("lesson.correction.status_open", "Still open")}
    </span>
  );
}
