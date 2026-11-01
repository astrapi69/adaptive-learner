/**
 * SetShareButton — a per-set "Share" control (#1572).
 *
 * Renders a share icon button next to a content set; clicking it opens the
 * shared {@link QrCodeModal} carrying a per-set link chosen by
 * {@link resolveSetShareLink} (#3819): the short ``…/content/set/<id>`` when
 * the recipient can resolve the set by its id, else the
 * ``…/add-repo?repo=…&set=…`` deep link that connects the repo first. The
 * modal's note says which: a short link stays valid while the set keeps its
 * id; an add-repo link carries the "public only / hand the token over
 * separately" hint. A token is NEVER part of the link.
 *
 * Self-contained + props-driven (just the set entry), so it drops into both
 * the grid {@link ContentSetRow} and the list {@link ContentSetListView} as
 * well as the set-detail deep-link page without threading modal state through
 * the parent. Tailwind + design tokens only; 44px touch target; the trigger
 * carries an accessible label naming the set.
 *
 * @example
 * <SetShareButton entry={entry} />
 */

import { Loader2, Share2 } from "lucide-react";
import { useState } from "react";

import { useI18n } from "../../../hooks/ui/useI18n";
import {
  resolveSetShareLink,
  type SetShareLink,
} from "../../../lib/content/placement/resolve-set-share-link";
import QrCodeModal from "../../../shared/feedback/QrCodeModal";
import type { ContentSetEntry } from "../../../storage/types";
import { notify } from "../../../utils/notify";

export interface SetShareButtonProps {
  /** The set to share. Only ``source`` / ``branch`` / ``id`` / ``title`` are read. */
  entry: ContentSetEntry;
  /** Optional testid override (defaults to ``set-share-{id}``). */
  testId?: string;
}

export default function SetShareButton({ entry, testId }: SetShareButtonProps) {
  const { t } = useI18n();
  const [link, setLink] = useState<SetShareLink | null>(null);
  const [resolving, setResolving] = useState(false);

  /** Resolve the link on demand: the registry is asked only when sharing. */
  const openShare = async () => {
    setResolving(true);
    try {
      setLink(
        await resolveSetShareLink({ source: entry.source, branch: entry.branch, id: entry.id }),
      );
    } finally {
      setResolving(false);
    }
  };

  const ariaLabel = t("content.share.aria", "Share set '{title}'").replace(
    "{title}",
    entry.title,
  );

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-app text-fg-muted hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={ariaLabel}
        title={t("content.share.button", "Share")}
        onClick={(event) => {
          // Never let the tap bubble to a row-level navigation target.
          event.stopPropagation();
          void openShare();
        }}
        disabled={resolving}
        aria-busy={resolving || undefined}
        data-testid={testId ?? `set-share-${entry.id}`}
      >
        {resolving ? (
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        ) : (
          <Share2 size={18} aria-hidden="true" />
        )}
      </button>
      {link && (
        <QrCodeModal
          url={link.url}
          title={t("content.share.title", "Share set")}
          note={
            link.short
              ? t(
                  "content.share.short_hint",
                  "This link opens the set directly. It stays valid as long as the set keeps its id.",
                )
              : t(
                  "content_repo.share.hint",
                  "Share this link so others can add this PUBLIC repository. For a private repository, send the URL and a read-only token separately.",
                )
          }
          labels={{
            close: t("common.close", "Close"),
            copy: t("share.app.copy_url", "Copy URL"),
            copied: t("share.app.copied", "Copied"),
            download: t("share.app.download_qr", "Download QR code"),
            share: t("share.app.share", "Share"),
            imageAlt: t("content_repo.share.qr_alt", "QR code for the share link"),
          }}
          fileName="adaptive-learner-set.png"
          onCopied={() => notify.success(t("content_repo.share.copied", "Link copied."))}
          onClose={() => setLink(null)}
          testId="set-share-modal"
        />
      )}
    </>
  );
}
