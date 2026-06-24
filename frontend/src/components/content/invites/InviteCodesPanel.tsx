/**
 * InviteCodesPanel — the coach's "Einladungscodes" surface for one content repo
 * (#1093). Reachable from the repo's Teilen panel. Generates codes (prefix /
 * max redemptions / expiry / note), lists the active codes, and offers
 * copy-code / copy-link / QR / deactivate per code.
 *
 * Token-required: a repo with no stored token shows a hint instead (the coach
 * writes code files to their own repo with their own credentials). The redeemed
 * count is server-mode-only (no central DB in the browser), shown as "—".
 */

import { Copy, Link2, QrCode as QrIcon, Ban, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "../../../hooks/ui/useI18n";
import {
  buildInviteLink,
  type InviteCodeFile,
} from "../../../lib/content/invites/invite-codes";
import QrCodeModal from "../../../shared/feedback/QrCodeModal";
import { notify } from "../../../utils/notify";
import { useInviteCodes } from "./useInviteCodes";

export interface InviteCodesPanelProps {
  /** ``owner/repo`` of the coach repo. */
  source: string;
  /** Branch the code files live on. */
  branch: string;
  /** Per-repo token (empty → the token-required hint). */
  token: string;
}

/** Absolute app origin (incl. Vite base path) for the invite links. */
function appOrigin(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${base}`;
}

export default function InviteCodesPanel({
  source,
  branch,
  token,
}: InviteCodesPanelProps) {
  const { t } = useI18n();
  const { codes, loading, working, error, generate, deactivate } =
    useInviteCodes(source, branch, token);

  const [prefix, setPrefix] = useState("");
  const [maxUses, setMaxUses] = useState(25);
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [qrFor, setQrFor] = useState<InviteCodeFile | null>(null);

  const origin = useMemo(appOrigin, []);
  const linkFor = (code: InviteCodeFile): string =>
    buildInviteLink(origin, { code: code.code, repo: source, branch });

  const handleGenerate = async (): Promise<void> => {
    const created = await generate({ prefix, maxUses, expires, note });
    if (created) {
      notify.success(t("invitation_code.generated", "Code generated."));
      setPrefix("");
      setNote("");
    } else if (!token.trim()) {
      // surfaced by the hint below
    } else {
      notify.error(t("invitation_code.error.generate", "Could not generate the code."));
    }
  };

  const copy = async (value: string, message: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      notify.success(message);
    } catch {
      notify.error(t("content_repo.share.copy_failed", "Could not copy."));
    }
  };

  if (!token.trim()) {
    return (
      <p
        className="m-0 text-sm text-[var(--fg-muted)]"
        data-testid="invite-codes-needs-token"
      >
        {t(
          "invitation_code.needs_token",
          "Add a token for this repository (above) to generate invitation codes.",
        )}
      </p>
    );
  }

  return (
    <div data-testid="invite-codes-panel">
      {/* Generate form */}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("invitation_code.field.prefix", "Prefix (optional)")}
          <Input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="DEUTSCH"
            data-testid="invite-code-prefix"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("invitation_code.field.max_uses", "Max. redemptions")}
          <Input
            type="number"
            min={0}
            value={maxUses}
            onChange={(e) => setMaxUses(Number(e.target.value))}
            data-testid="invite-code-max-uses"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("invitation_code.field.expires", "Valid until")}
          <Input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            data-testid="invite-code-expires"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("invitation_code.field.note", "Note")}
          <Input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("invitation_code.field.note_placeholder", "e.g. Class 8a")}
            data-testid="invite-code-note"
          />
        </label>
      </div>
      <Button
        type="button"
        size="sm"
        className="mt-2 min-h-11 gap-2"
        onClick={handleGenerate}
        disabled={working}
        data-testid="invite-code-generate"
      >
        {working ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        {t("invitation_code.generate", "Generate code")}
      </Button>

      {error && (
        <p
          className="mt-2 text-sm font-medium text-[var(--error)]"
          role="status"
          data-testid="invite-codes-error"
        >
          {error}
        </p>
      )}

      {/* Active codes */}
      <h5 className="mt-4 mb-1 text-sm font-semibold">
        {t("invitation_code.active.title", "Active codes")}
      </h5>
      {loading ? (
        <p className="m-0 text-sm text-[var(--fg-muted)]">
          {t("common.loading", "Loading…")}
        </p>
      ) : codes.length === 0 ? (
        <p
          className="m-0 text-sm text-[var(--fg-muted)]"
          data-testid="invite-codes-empty"
        >
          {t("invitation_code.active.empty", "No codes yet.")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" data-testid="invite-codes-table">
            <thead>
              <tr className="text-left text-[var(--fg-muted)]">
                <th className="py-1 pr-3">{t("invitation_code.col.code", "Code")}</th>
                <th className="py-1 pr-3">{t("invitation_code.col.redeemed", "Redeemed")}</th>
                <th className="py-1 pr-3">{t("invitation_code.col.max", "Max")}</th>
                <th className="py-1 pr-3">{t("invitation_code.col.valid", "Valid")}</th>
                <th className="py-1">{t("invitation_code.col.actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <tr
                  key={code.code}
                  className="border-t border-[var(--border)]"
                  data-testid={`invite-code-row-${code.code}`}
                >
                  <td className="py-2 pr-3 font-mono">
                    {code.code}
                    {code.deactivated && (
                      <span
                        className="ml-2 rounded-sm bg-[var(--bg-elevated)] px-1.5 py-0.5 text-xs text-[var(--fg-muted)]"
                        data-testid={`invite-code-inactive-${code.code}`}
                      >
                        {t("invitation_code.badge.inactive", "Inactive")}
                      </span>
                    )}
                  </td>
                  <td
                    className="py-2 pr-3 text-[var(--fg-muted)]"
                    title={t(
                      "invitation_code.redeemed_hint",
                      "Redemption counts need the desktop app.",
                    )}
                  >
                    {"–"}
                  </td>
                  <td className="py-2 pr-3">
                    {code.max_uses > 0 ? code.max_uses : "∞"}
                  </td>
                  <td className="py-2 pr-3">
                    {code.expires
                      ? code.expires
                      : t("invitation_code.never_expires", "No expiry")}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-9 gap-1"
                        onClick={() =>
                          copy(code.code, t("invitation_code.code_copied", "Code copied."))
                        }
                        data-testid={`invite-code-copy-${code.code}`}
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("invitation_code.action.copy_code", "Copy code")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-9 gap-1"
                        onClick={() =>
                          copy(linkFor(code), t("invitation_code.link_copied", "Invite link copied."))
                        }
                        data-testid={`invite-code-copy-link-${code.code}`}
                      >
                        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("invitation_code.action.copy_link", "Copy link")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-9 gap-1"
                        onClick={() => setQrFor(code)}
                        data-testid={`invite-code-qr-${code.code}`}
                      >
                        <QrIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("invitation_code.action.qr", "QR code")}
                      </Button>
                      {!code.deactivated && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9 gap-1"
                          onClick={() => deactivate(code.code)}
                          disabled={working}
                          data-testid={`invite-code-deactivate-${code.code}`}
                        >
                          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("invitation_code.action.deactivate", "Deactivate")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {qrFor && (
        <QrCodeModal
          url={linkFor(qrFor)}
          title={t("invitation_code.qr_title", "Invitation code")}
          fileName={`invite-${qrFor.code}.png`}
          labels={{
            close: t("common.close", "Close"),
            copy: t("content_repo.share.copy", "Copy"),
            download: t("share.app.download", "Download"),
            share: t("share.app.share", "Share"),
            imageAlt: t("invitation_code.qr_alt", "QR code for the invitation link"),
          }}
          onCopied={() => notify.success(t("invitation_code.link_copied", "Invite link copied."))}
          onClose={() => setQrFor(null)}
        />
      )}
    </div>
  );
}
