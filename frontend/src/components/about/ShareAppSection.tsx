/**
 * ShareAppSection (About tab).
 *
 * Lets the user share the app's public URL so others can open it
 * directly. Since #1172 it offers two deployment strands:
 *
 *   - **Haupt** (production, stable): a "Show QR code" button opens the
 *     reusable {@link QrCodeModal} (copy / download PNG / native share)
 *     pointed at the production URL.
 *   - **Latest** (preview/staging, unstable): a plain link to the
 *     content-test URL plus an explicit instability warning — NO QR code,
 *     because a test build that can contain bugs should not be spread via
 *     a scan-and-go QR.
 *
 * Works in both storage modes: the URLs are static GitHub-Pages addresses,
 * no backend or Dexie call involved. Token-backed Tailwind only.
 */

import { AlertTriangle, ExternalLink, QrCode } from "lucide-react";
import { useState } from "react";

import { HAUPT_APP_URL, LATEST_APP_URL } from "../../lib/share/generate-share-text";
import QrCodeModal from "../../shared/feedback/QrCodeModal";
import { notify } from "../../utils/notify";

interface Props {
  t: (key: string, fallback?: string) => string;
}

const sectionStyle: React.CSSProperties = {
  borderTop: "1px solid var(--border)",
  paddingTop: 16,
};

export default function ShareAppSection({ t }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <article data-testid="about-share-section" style={sectionStyle}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>
        {t("share.app.heading", "Share the app")}
      </h3>

      {/* ---- Haupt (production / stable) ---- */}
      <div
        className="rounded-md border border-border p-3"
        data-testid="about-share-haupt"
      >
        <h4 className="mb-1 text-sm font-semibold text-fg-primary">
          {t("share.app.haupt_label", "Main version (stable)")}
        </h4>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          {t(
            "share.app.haupt_intro",
            "Share the stable app via QR code so others can open it.",
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted"
            data-testid="about-share-show-qr"
          >
            <QrCode size={16} aria-hidden="true" />
            {t("share.app.show_qr", "Show QR code")}
          </button>
          <a
            href={HAUPT_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted"
            data-testid="about-share-haupt-link"
          >
            <ExternalLink size={16} aria-hidden="true" />
            {t("share.app.open_link", "Open link")}
          </a>
        </div>
      </div>

      {/* ---- Latest (preview / unstable) ---- */}
      <div
        className="mt-3 rounded-md border p-3"
        style={{
          borderColor: "var(--warning)",
          background: "var(--warning-bg)",
        }}
        data-testid="about-share-latest"
      >
        <h4 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-warning">
          <AlertTriangle size={16} aria-hidden="true" />
          {t("share.app.latest_label", "Latest version (test)")}
        </h4>
        <p
          className="text-sm text-fg-secondary"
          style={{ marginTop: 0, marginBottom: 8 }}
          data-testid="about-share-latest-warning"
        >
          {t(
            "share.app.latest_warning",
            "This is a preview/test version. It is not stable and may contain errors. Share it only with testers.",
          )}
        </p>
        <a
          href={LATEST_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-[var(--bg-surface)] px-3 text-sm font-medium text-fg-secondary hover:bg-muted"
          data-testid="about-share-latest-link"
        >
          <ExternalLink size={16} aria-hidden="true" />
          {t("share.app.open_link", "Open link")}
        </a>
      </div>

      {open && (
        <QrCodeModal
          url={HAUPT_APP_URL}
          title={t(
            "share.app.haupt_intro",
            "Share the stable app via QR code so others can open it.",
          )}
          fileName="adaptive-learner-qr.png"
          labels={{
            close: t("common.close", "Close"),
            copy: t("share.app.copy_url", "Copy URL"),
            copied: t("share.app.copied", "Copied"),
            download: t("share.app.download_qr", "Download QR code"),
            share: t("share.app.share", "Share"),
            imageAlt: t("share.app.qr_alt", "QR code linking to the app"),
          }}
          onCopied={() => notify.success(t("share.app.copied", "Copied"))}
          onClose={() => setOpen(false)}
        />
      )}
    </article>
  );
}
