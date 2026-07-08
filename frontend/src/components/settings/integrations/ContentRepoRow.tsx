/**
 * ContentRepoRow — ONE connected user content-repository row in the
 * Settings section (extracted from {@link ContentRepoSettingsSection} for
 * the file-size cohesion gate, #1388).
 *
 * Fully presentational and props-driven: the section owns the repo list,
 * the sync/move/share/remove handlers, and the per-row sync state
 * (running row, row error, #1388); this component renders one row —
 * identity + category badge, last-sync line, local star rating, the
 * running/error feedback, the action buttons, and the share panel.
 */

import {
  ArrowDown,
  ArrowUp,
  FolderGit2,
  Copy,
  Loader2,
  RefreshCw,
  Share2,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RepoCategoryBadge from "../../content/RepoCategoryBadge";
import InviteCodesPanel from "../../content/invites/InviteCodesPanel";
import { useI18n } from "../../../hooks/ui/useI18n";
import {
  resolveRepoCategory,
  userRepoSource,
  type UserContentRepo,
} from "../../../lib/content/repos/content-repos";

export interface ContentRepoRowProps {
  repo: UserContentRepo;
  /** Whether this source appears in the curated recommended list. */
  recommended: boolean;
  /** The learner's local star rating for this source (0 = none). */
  rating: number;
  onRate: (rating: number) => void;
  /** This row's sync is currently running (#1388). */
  isSyncing: boolean;
  /** Row-level failure message from the last sync, when any (#1388). */
  rowError: string | undefined;
  /** Current sync-phase label while this row syncs, when known. */
  progressLabel: string | undefined;
  /** Disable all row actions (another operation is running). */
  actionsDisabled: boolean;
  /** The remove button is in its confirm step. */
  confirmRemove: boolean;
  isFirst: boolean;
  isLast: boolean;
  /** Open share panel state for THIS row, or null when closed. */
  share: { link: string; qr: string } | null;
  shareTab: "link" | "codes";
  setShareTab: (tab: "link" | "codes") => void;
  /** Per-repo token for the invite-codes panel. */
  token: string;
  onSync: () => void;
  onMove: (direction: -1 | 1) => void;
  onToggleShare: () => void;
  onRemove: () => void;
  onCopyLink: (link: string) => void;
}

export default function ContentRepoRow({
  repo,
  recommended,
  rating,
  onRate,
  isSyncing,
  rowError,
  progressLabel,
  actionsDisabled,
  confirmRemove,
  isFirst,
  isLast,
  share,
  shareTab,
  setShareTab,
  token,
  onSync,
  onMove,
  onToggleShare,
  onRemove,
  onCopyLink,
}: ContentRepoRowProps) {
  const { t } = useI18n();
  const source = userRepoSource(repo.owner, repo.repo);

  return (
    <li
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3"
      data-testid={`content-repo-item-${repo.owner}-${repo.repo}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FolderGit2
          className="h-5 w-5 text-[var(--fg-muted)]"
          aria-hidden="true"
        />
        <span className="font-medium">{source}</span>
        <span className="text-xs text-[var(--fg-muted)]">
          @{repo.branch}
        </span>
        {/* #1319 — one unified, typed category badge (official /
            private / validated / unverified) replaces the previously
            scattered trust + coach + recommended inline badges. */}
        <RepoCategoryBadge
          category={resolveRepoCategory({
            source,
            trust: repo.trust,
            coach: repo.coach,
            recommended: recommended,
          })}
          t={t}
          testId={`content-repo-category-${repo.owner}-${repo.repo}`}
        />
      </div>
      <p className="m-0 mt-1 text-sm text-[var(--fg-muted)]">
        {repo.last_synced
          ? t("content_repo.last_sync", "Last sync: {when}").replace(
              "{when}",
              new Date(repo.last_synced).toLocaleString(),
            )
          : t("content_repo.status.never_synced", "Not synced yet")}
        {" · "}
        {t("content_repo.user.counts", "{sets} sets · {lessons} lessons")
          .replace("{sets}", String(repo.set_count))
          .replace("{lessons}", String(repo.lesson_count))}
      </p>
      <div
        className="mt-2 flex items-center gap-1"
        role="radiogroup"
        aria-label={t("content_repo.rating.aria", "Your rating")}
        data-testid={`content-repo-rating-${repo.owner}-${repo.repo}`}
      >
        <span className="mr-1 text-xs text-[var(--fg-muted)]">
          {t("content_repo.rating.label", "Your rating")}
        </span>
        {[1, 2, 3, 4, 5].map((n) => {
          const rated = (rating) >= n;
          return (
            <button
              key={n}
              type="button"
              className="inline-flex h-11 w-7 items-center justify-center text-[var(--star)]"
              onClick={() => onRate(n)}
              role="radio"
              aria-checked={(rating) === n}
              aria-label={t(
                "content_repo.rating.star",
                "Rate {n} of 5",
              ).replace("{n}", String(n))}
              data-testid={`content-repo-rating-${repo.owner}-${repo.repo}-star-${n}`}
            >
              <Star
                className="h-4 w-4"
                aria-hidden="true"
                fill={rated ? "currentColor" : "none"}
              />
            </button>
          );
        })}
      </div>
      {/* #1388 — running state + failure feedback AT the row. */}
      {isSyncing && (
        <p
          className="m-0 mt-1 flex items-center gap-2 text-sm text-[var(--fg-muted)]"
          role="status"
          aria-live="polite"
          data-testid={`content-repo-syncing-${repo.owner}-${repo.repo}`}
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {progressLabel ??
            t("content_repo.progress.syncing", "Syncing…")}
        </p>
      )}
      {rowError && !isSyncing && (
        <p
          className="m-0 mt-1 text-sm font-medium text-[var(--error)]"
          role="alert"
          data-testid={`content-repo-sync-error-${repo.owner}-${repo.repo}`}
        >
          {rowError}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11 gap-2"
          onClick={() => onSync()}
          disabled={actionsDisabled}
          data-testid={`content-repo-sync-${repo.owner}-${repo.repo}`}
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          {t("content_repo.action.sync", "Sync now")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => onMove(-1)}
          disabled={actionsDisabled || isFirst}
          aria-label={t("content_repo.action.move_up", "Move up")}
          title={t("content_repo.action.move_up", "Move up")}
          data-testid={`content-repo-up-${repo.owner}-${repo.repo}`}
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => onMove(1)}
          disabled={actionsDisabled || isLast}
          aria-label={t("content_repo.action.move_down", "Move down")}
          title={t("content_repo.action.move_down", "Move down")}
          data-testid={`content-repo-down-${repo.owner}-${repo.repo}`}
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </Button>
        {/* #1093 — owner-only Teilen: a repo added by redeeming an
            invitation code is a guest copy, so it offers no re-share. */}
        {!repo.shared_via_invite && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-2"
            onClick={() => onToggleShare()}
            disabled={actionsDisabled}
            data-testid={`content-repo-share-${repo.owner}-${repo.repo}`}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            {t("content_repo.action.share", "Share")}
          </Button>
        )}
        <Button
          type="button"
          variant={confirmRemove ? "destructive" : "outline"}
          size="sm"
          className="min-h-11 gap-2"
          onClick={() => onRemove()}
          disabled={actionsDisabled}
          data-testid={`content-repo-remove-${repo.owner}-${repo.repo}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {/* #1445 — the confirmation (incl. the opt-in progress delete) now
              lives in RemoveRepoDialog; this button just opens it. */}
          {t("content_repo.action.remove", "Remove")}
        </Button>
      </div>
      {share !== null && (
        <div
          className="mt-3 rounded-sm border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
          data-testid={`content-repo-share-panel-${repo.owner}-${repo.repo}`}
        >
          {/* #1093 — Teilen splits into Link sharing + Invitation codes. */}
          <div
            className="mb-3 flex gap-1"
            role="tablist"
            aria-label={t("content_repo.action.share", "Share")}
          >
            <Button
              type="button"
              size="sm"
              variant={shareTab === "link" ? "default" : "outline"}
              className="min-h-9"
              role="tab"
              aria-selected={shareTab === "link"}
              onClick={() => setShareTab("link")}
              data-testid="content-repo-share-tab-link"
            >
              {t("content_repo.share.tab_link", "Link")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={shareTab === "codes" ? "default" : "outline"}
              className="min-h-9"
              role="tab"
              aria-selected={shareTab === "codes"}
              onClick={() => setShareTab("codes")}
              data-testid="content-repo-share-tab-codes"
            >
              {t("invitation_code.title", "Invitation codes")}
            </Button>
          </div>

          {shareTab === "link" ? (
            <>
              <p className="m-0 text-sm text-[var(--fg-muted)]">
                {t(
                  "content_repo.share.hint",
                  "Share this link so others can add this PUBLIC repo. For a private repo, send the URL + a read-only token separately.",
                )}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  type="text"
                  readOnly
                  value={share.link}
                  className="min-w-[16rem] flex-1"
                  data-testid="content-repo-share-link"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11 gap-2"
                  onClick={() => onCopyLink(share.link)}
                  data-testid="content-repo-share-copy"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {t("content_repo.share.copy", "Copy")}
                </Button>
              </div>
              {share.qr && (
                <img
                  src={share.qr}
                  alt={t("content_repo.share.qr_alt", "QR code for the share link")}
                  className="mt-3 rounded-sm"
                  width={180}
                  height={180}
                  data-testid="content-repo-share-qr"
                />
              )}
            </>
          ) : (
            <InviteCodesPanel
              source={source}
              branch={repo.branch}
              token={token}
            />
          )}
        </div>
      )}
    </li>
  );
}
