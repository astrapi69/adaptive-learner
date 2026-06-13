/**
 * Share Wizard step 3 — quality summary from the rule-based validator
 * (re-run against the corrected metadata in {@link useShareWizard}) plus
 * the optional AI-review block passed in by the page. Warnings never
 * block sharing.
 */

import { useI18n } from "../../hooks/useI18n";
import type { UseShareWizardResult } from "../../hooks/useShareWizard";

export default function ShareWizardStep3({ wiz }: { wiz: UseShareWizardResult }) {
  const { t } = useI18n();
  const { checking, liveValidation, validationMessage, aiSection } = wiz;

  return (
    <section data-testid="share-wizard-step-3">
      {checking || !liveValidation ? (
        <p>{t("content.validation.checking", "Checking your lesson…")}</p>
      ) : liveValidation.ok ? (
        <p
          className="content-share-passed"
          data-testid="share-wizard-quality-ok"
        >
          {t("content.validation.passed", "Quality check passed. Ready to share with the community.")}
        </p>
      ) : (
        <>
          <p
            className="content-share-failed"
            data-testid="share-wizard-quality-issues"
          >
            {t("content.validation.failed_share_anyway", "Quality check found issues. You can share anyway — reviewers will see the findings noted in the pull request.")}
          </p>
          <ul className="content-share-issues">
            {liveValidation.issues.map((issue, i) => (
              <li key={`${issue.code}-${i}`}>{validationMessage(issue)}</li>
            ))}
          </ul>
        </>
      )}
      {liveValidation && liveValidation.warnings.length > 0 && (
        <ul className="content-share-warnings">
          {liveValidation.warnings.map((w, i) => (
            <li key={`${w.code}-${i}`}>{validationMessage(w)}</li>
          ))}
        </ul>
      )}
      {aiSection}
    </section>
  );
}
