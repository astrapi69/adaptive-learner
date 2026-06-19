/**
 * ShareAppSection (About tab).
 *
 * Lets the user share the app's public URL so others can open it
 * directly — a "Show QR code" button opens the reusable
 * {@link QrCodeModal} (copy / download PNG / native share). Works in
 * both storage modes: the URL is the static GitHub-Pages address, no
 * backend or Dexie call involved.
 */

import { QrCode } from "lucide-react";
import { useState } from "react";

import { SHARE_URL } from "../../lib/share/generate-share-text";
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
      <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
        {t("share.app.qr_intro", "Share the app via QR code so others can open it.")}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted"
        data-testid="about-share-show-qr"
      >
        <QrCode size={16} aria-hidden="true" />
        {t("share.app.show_qr", "Show QR code")}
      </button>

      {open && (
        <QrCodeModal
          url={SHARE_URL}
          title={t("share.app.qr_intro", "Share the app via QR code so others can open it.")}
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
