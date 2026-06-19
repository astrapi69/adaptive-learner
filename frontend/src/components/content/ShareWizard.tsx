/**
 * Community sharing wizard (Phase 64C).
 *
 * Redesigns the one-shot "Share with Community" modal into a friendly
 * four-step flow that makes contributing feel rewarding, not
 * bureaucratic:
 *
 *   1. Preview + automatic PLACEMENT (where the lesson lands + a
 *      suggested filename, or "you're the first" for a new set).
 *   2. DUPLICATE scan against the lessons already in that tree path —
 *      advisory only: offer "share as variation" or "suggest only the
 *      new exercises" when something similar exists.
 *   3. Quality summary (the existing rule-based validator + optional
 *      AI review, passed in as a node) — warnings never block.
 *   4. One-click share as a PULL REQUEST + a celebration (confetti +
 *      thank-you + a link to the opened PR). Small lessons use a
 *      pre-filled GitHub create-file URL (the PR title + body seed
 *      from the commit); large / multi-lesson sets download the
 *      JSON and open the repo's upload page (drag-drop → PR).
 *
 * This component is the step orchestrator: it owns the Dialog shell,
 * the header, the step switch, and the nav. All state, derived values,
 * effects, and the share ACTION live in {@link useShareWizard}; each
 * step's presentation lives in its own ShareWizardStep* component.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { useI18n } from "../../hooks/ui/useI18n";
import {
  useShareWizard,
  type ShareWizardProps,
} from "../../hooks/content/useShareWizard";
import { TOTAL_STEPS, type Step } from "./shareWizardHelpers";
import ShareWizardStep1 from "./ShareWizardStep1";
import ShareWizardStep2 from "./ShareWizardStep2";
import ShareWizardStep3 from "./ShareWizardStep3";
import ShareWizardStep4 from "./ShareWizardStep4";

export type { ShareWizardProps };

export default function ShareWizard(props: ShareWizardProps) {
  const { t } = useI18n();
  const { onClose } = props;
  const wiz = useShareWizard(props);
  const { step, setStep, sharedUrl, step1Blocked, stepLabel } = wiz;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        data-testid="content-share-wizard"
        aria-describedby="share-wizard-description"
        className="max-h-[90vh] overflow-y-auto"
      >
        <header className="share-wizard-header">
          <DialogTitle id="share-wizard-title" className="modal-title">
            {t("content.wizard.title", "Share with the community")}
          </DialogTitle>
          <DialogDescription
            id="share-wizard-description"
            className="share-wizard-progress"
            data-testid="share-wizard-progress"
          >
            {stepLabel}
          </DialogDescription>
        </header>

        {/* Step 1 — Preview + placement */}
        {step === 1 && <ShareWizardStep1 wiz={wiz} />}

        {/* Step 2 — Duplicate / variation check */}
        {step === 2 && <ShareWizardStep2 wiz={wiz} />}

        {/* Step 3 — Quality summary */}
        {step === 3 && <ShareWizardStep3 wiz={wiz} />}

        {/* Step 4 — Share as a pull request + celebration */}
        {step === 4 && <ShareWizardStep4 wiz={wiz} />}

        <div className="form-actions share-wizard-nav">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            data-testid="share-wizard-close"
          >
            {sharedUrl
              ? t("content.wizard.done", "Done")
              : t("content.validation.cancel", "Close")}
          </Button>
          {step > 1 && !sharedUrl && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep((s) => (s - 1) as Step)}
              data-testid="share-wizard-back"
            >
              {t("content.wizard.back", "Back")}
            </Button>
          )}
          {step < TOTAL_STEPS && (
            <Button
              type="button"
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={step === 1 && step1Blocked}
              data-testid="share-wizard-next"
            >
              {t("content.wizard.next", "Continue")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
