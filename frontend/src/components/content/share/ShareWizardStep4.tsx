/**
 * Share Wizard step 4 — the share action (programmatic PR or pre-filled
 * URL fallback), the phased progress / error UI, and the post-share
 * celebration with instructions and the GitHub link. All state and the
 * share handlers come from {@link useShareWizard}.
 */

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../hooks/ui/useI18n";
import FormHint from "../../../shared/forms/FormHint";
import type { UseShareWizardResult } from "../../../hooks/content/useShareWizard";

export default function ShareWizardStep4({ wiz }: { wiz: UseShareWizardResult }) {
  const { t } = useI18n();
  const {
    sharedUrl,
    automated,
    shareMethod,
    prefilled,
    copyPrBody,
    copied,
    prBody,
    popupBlocked,
    prStage,
    prError,
    runUrlShare,
    buildShareContext,
    online,
    tokenConfigured,
    doShare,
  } = wiz;

  return (
    <section data-testid="share-wizard-step-4">
      {sharedUrl ? (
        <div
          className="share-wizard-celebration flex flex-col gap-3"
          data-testid="share-wizard-celebration"
        >
          <p className="share-wizard-thanks font-medium">
            {t("content.wizard.thanks", "Thanks for sharing! Your contribution helps other learners.")}
          </p>
          {automated ? (
            <p data-testid="share-wizard-pr-created">
              {t("share.pr.success", "Pull request created! Your lesson was committed and a pull request opened on GitHub - the content-repo CI validates it automatically.")}
            </p>
          ) : shareMethod === "pr" && prefilled ? (
            <p data-testid="share-wizard-pr-instructions">
              {t("content.wizard.submitted", "A pull request was opened on GitHub with your lesson pre-filled. Review it and click \"Create pull request\" - the content-repo CI validates it automatically.")}
            </p>
          ) : (
            <>
              {shareMethod === "pr" ? (
                // Large single lesson: the create-file editor opened
                // at the right path with the title/description filled
                // in, but the JSON was too big to pre-fill — the user
                // pastes the downloaded file's contents.
                <p data-testid="share-wizard-paste-instructions">
                  {t("content.wizard.paste_instructions", "Your lesson file was downloaded and GitHub's new-file editor opened at the right path. Open the downloaded file, paste its contents into the editor, then click \"Propose new file\" - the title and description are already filled in.")}
                </p>
              ) : (
                <p data-testid="share-wizard-upload-instructions">
                  {t("content.wizard.upload_instructions", "Your lesson file was downloaded. On the GitHub page that just opened, drag the file into the upload area and click \"Propose changes\" - GitHub creates the pull request for you.")}
                </p>
              )}
              <div className="share-wizard-copy-body flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={copyPrBody}
                  data-testid="share-wizard-copy-pr-body"
                >
                  {copied
                    ? t("content.wizard.copy_pr_body_done", "Copied!")
                    : t("content.wizard.copy_pr_body", "Copy pull-request description")}
                </Button>
                <textarea
                  className="share-wizard-pr-body w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid="share-wizard-pr-body"
                  readOnly
                  rows={6}
                  value={prBody}
                />
              </div>
            </>
          )}
          {popupBlocked && (
            <FormHint
              variant="warning"
              data-testid="share-wizard-popup-blocked"
              role="alert"
            >
              {t(
                "content.wizard.popup_blocked",
                "Your browser blocked the GitHub tab. Click the link below to open it manually.",
              )}
            </FormHint>
          )}
          <a
            href={sharedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={popupBlocked ? "btn btn-primary" : undefined}
            data-testid="share-wizard-pr-link"
          >
            {shareMethod === "upload"
              ? t(
                  "content.wizard.view_upload",
                  "Open the GitHub upload page",
                )
              : t(
                  "content.wizard.view_submission",
                  "Open the pull request on GitHub",
                )}
          </a>
        </div>
      ) : (
        <div data-testid="share-wizard-confirm">
          {prStage === "preparing" ||
          prStage === "uploading" ||
          prStage === "creating" ? (
            <p
              className="share-wizard-pr-progress text-sm text-fg-secondary"
              data-testid="share-wizard-pr-progress"
              role="status"
            >
              {prStage === "preparing"
                ? t("share.pr.preparing", "Preparing repository…")
                : prStage === "creating"
                  ? t("share.pr.creating", "Creating pull request…")
                  : t("share.pr.uploading", "Uploading lesson…")}
            </p>
          ) : prStage === "error" ? (
            <div
              className="content-share-failed"
              data-testid="share-wizard-pr-error"
              role="alert"
            >
              <p>{prError}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => runUrlShare(buildShareContext())}
                disabled={!online}
                data-testid="share-wizard-pr-fallback"
              >
                {t("share.pr.fallback", "Share manually via GitHub instead")}
              </Button>
            </div>
          ) : (
            <>
              <p>
                {t("content.wizard.ready_to_share", "Everything's ready. Share your lesson as a pull request?")}
              </p>
              {tokenConfigured === false && (
                <p
                  className="muted"
                  data-testid="share-wizard-no-token"
                >
                  {t("share.pr.no_token", "Tip: add a GitHub token in Settings > Integrations to create the pull request automatically.")}
                </p>
              )}
              <Button
                type="button"
                onClick={doShare}
                disabled={!online}
                title={
                  !online
                    ? t("pwa.action_unavailable", "Not available offline")
                    : undefined
                }
                data-testid="share-wizard-share"
              >
                {t("content.wizard.share_button", "Share")}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
