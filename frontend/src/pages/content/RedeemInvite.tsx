/**
 * Redeem-invitation-code page (#1093), route ``/invite``.
 *
 * Serves both the deep link / QR (``/invite?code=…&repo=…``) and the manual
 * "Einladungscode eingeben" entry from the Import tab: a single field, seeded
 * from the URL when present, that accepts a full invite link OR a bare code.
 * On success the granted repo is added (flagged ``shared_via_invite`` so the
 * learner never sees a re-share control) and synced, then we go to
 * ``/content?tab=my``. Mirrors the ``/add-repo`` deep-link flow.
 */

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DownloadProgress from "../../shared/feedback/DownloadProgress";
import { useI18n } from "../../hooks/ui/useI18n";
import { syncPhaseI18n } from "../../lib/content/repos/content-repos";
import {
  buildInviteLink,
  redeemStatusI18n,
} from "../../lib/content/invites/invite-codes";
import {
  redeemInviteInput,
  type RedeemFailReason,
} from "../../lib/content/invites/redeem-invite";
import PageContainer from "../../shared/layout/PageContainer";
import { notify } from "../../utils/notify";

export default function RedeemInvite() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    label: string;
    current: number;
    total: number;
  } | null>(null);

  const seeded = useMemo(() => {
    const code = params.get("code") ?? "";
    const repo = params.get("repo") ?? "";
    const branch = params.get("branch") || "main";
    if (code && repo) return buildInviteLink(window.location.origin, { code, repo, branch });
    return code;
  }, [params]);
  const [input, setInput] = useState(seeded);

  /** Map a redeem failure to a localized, actionable message. */
  const failMessage = (reason: RedeemFailReason, detail?: string): string => {
    switch (reason) {
      case "no_code":
        return t("invitation_code.redeem.enter", "Enter an invitation code or link.");
      case "no_repo":
        return t(
          "invitation_code.redeem.needs_link",
          "Paste the full invitation link. It carries the repository the code unlocks.",
        );
      case "not_found":
        return t("invitation_code.error.not_found", "Invitation code not found.");
      case "expired":
      case "inactive":
      case "full": {
        const { key, fallback } = redeemStatusI18n(reason);
        return t(key, fallback);
      }
      case "validate_failed":
        return t(
          "invitation_code.error.repo_failed",
          "Could not add the repository: {reason}",
        ).replace("{reason}", detail ?? "");
      default:
        return t("invitation_code.error.generic", "Could not redeem the code. Try again.");
    }
  };

  const handleRedeem = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setProgress({
      label: t("content_repo.progress.validating", "Validating repository…"),
      current: 0,
      total: 0,
    });
    const outcome = await redeemInviteInput(input, (p) => {
      const { key, fallback } = syncPhaseI18n(p.phase);
      setProgress({ label: t(key, fallback), current: p.current, total: p.total });
    });
    setBusy(false);
    setProgress(null);
    if (outcome.ok) {
      notify.success(
        t("invitation_code.redeem.success", "Content added: {sets} sets.").replace(
          "{sets}",
          String(outcome.setCount),
        ),
      );
      navigate("/content?tab=my");
      return;
    }
    setError(failMessage(outcome.reason, outcome.detail));
  };

  return (
    <PageContainer testId="redeem-invite-page">
      <div className="mx-auto mt-10 max-w-md rounded-md border border-[var(--border)] bg-[var(--surface)] p-6">
        <h1 className="m-0 text-xl font-semibold">
          {t("invitation_code.redeem.title", "Redeem an invitation code")}
        </h1>
        <p className="mt-3 text-sm text-[var(--fg-muted)]">
          {t(
            "invitation_code.redeem.body",
            "Enter the code or link your coach gave you to add their lessons. No account needed.",
          )}
        </p>
        <label className="mt-4 flex flex-col gap-1 text-sm">
          {t("invitation_code.redeem.label", "Invitation code or link")}
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="DEUTSCH-8X4K"
            disabled={busy}
            data-testid="redeem-invite-input"
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>

        {error && (
          <p
            className="mt-3 text-sm font-medium text-[var(--error)]"
            role="status"
            data-testid="redeem-invite-error"
          >
            {error}
          </p>
        )}
        {progress && (
          <div
            className="mt-3 flex flex-col gap-2"
            role="status"
            aria-live="polite"
            data-testid="redeem-invite-progress"
          >
            <span className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {progress.total > 0
                ? `${progress.label} (${progress.current}/${progress.total})`
                : progress.label}
            </span>
            {progress.total > 0 && (
              <DownloadProgress
                current={progress.current}
                total={progress.total}
                ariaLabel={progress.label}
                testId="redeem-invite-progress-bar"
              />
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11"
            onClick={handleRedeem}
            disabled={busy || !input.trim()}
            data-testid="redeem-invite-submit"
          >
            {t("invitation_code.action.redeem", "Redeem")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => navigate("/content?tab=my")}
            disabled={busy}
            data-testid="redeem-invite-cancel"
          >
            {t("content_repo.action.cancel", "Cancel")}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
