/**
 * One downloaded content-set row in the /content browse tree
 * (extracted from Content.tsx, #401).
 *
 * Renders the set's title + source/trust/recommended badges, the
 * language-pair / level / lesson-count tags, the cached + update
 * status, and the per-row Open / Download action. Pure presentation —
 * all state and actions come from props. The two-column layout is the
 * generic ``shared/ListRow`` primitive; the content-specific badge,
 * tag, status and action blocks live in the sub-components below.
 */

import { BookOpen, Download, FolderOpen, ListChecks, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import ListRow from "../../shared/layout/ListRow";
import AiCheckedBadge, { type AiCheckBadgeStatus } from "../../shared/status/AiCheckedBadge";
import { useI18n } from "../../hooks/ui/useI18n";
import { isOfficialSource } from "../../lib/content/repos/content-repos";
import type { MediaResource } from "../../lib/content/media/media-loader";
import type { ContentSetEntry } from "../../storage/types";
import SetMediaBadges from "./SetMediaBadges";

export type DownloadState = "idle" | "downloading" | "done" | "error";

type RepoMeta = Record<string, { trust: number; coach: boolean }>;

interface ContentSetRowProps {
  entry: ContentSetEntry;
  downloadState: DownloadState;
  online: boolean;
  repoMeta: RepoMeta;
  recommendedSources: Set<string>;
  onOpen: (entry: ContentSetEntry) => void;
  onDownload: (entry: ContentSetEntry) => void;
  /** EXP-029 / MED-06 — supplementary media available for this set
   *  (already filtered to its domain). Drives the media-availability
   *  badges; empty -> no badges. */
  mediaResources?: MediaResource[];
  /** Open the set's first lesson focused on its media section
   *  (badge click). Defaults to {@link onOpen}. */
  onOpenMedia?: (entry: ContentSetEntry) => void;
  /** EXP-033 / AIV-02 — open the AI content-check dialog. Omit to hide
   *  the "Check with AI" button. */
  onAiCheck?: (entry: ContentSetEntry) => void;
  /** When set, the AI-check button is rendered VISIBLE but DISABLED with
   *  this reason as its tooltip (feature-state policy, #335). */
  aiCheckDisabledReason?: string;
  /** EXP-032 / CQV — open the deterministic, offline content-quality
   *  dialog (accents / articles / duplicates). Omit to hide the button. */
  onQualityCheck?: (entry: ContentSetEntry) => void;
  /** EXP-033 / AIV-11 — "AI-checked" signature badge status for this set.
   *  Defaults to "none" (no badge). */
  aiBadgeStatus?: AiCheckBadgeStatus;
}

/** Origin / trust / recommended badges for a non-official source. */
function ContentSetOriginBadges({
  entry,
  repoMeta,
  recommendedSources,
}: {
  entry: ContentSetEntry;
  repoMeta: RepoMeta;
  recommendedSources: Set<string>;
}) {
  const { t } = useI18n();
  if (isOfficialSource(entry.source)) return null;
  const trusted = repoMeta[entry.source]?.trust === 1;
  return (
    <>
      <span
        className="ml-1 rounded-sm bg-[var(--info-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--info)]"
        data-testid={`content-set-${entry.id}-origin`}
      >
        {repoMeta[entry.source]?.coach
          ? t("content.origin.coach", "Coach")
          : t("content.origin.user", "Your repo")}
      </span>
      <span
        className={
          trusted
            ? "ml-1 rounded-sm bg-[var(--success-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--success)]"
            : "ml-1 rounded-sm bg-[var(--warning-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--warning)]"
        }
        data-testid={`content-set-${entry.id}-trust`}
      >
        {trusted
          ? t("content.trust.validated", "Validated")
          : t("content.trust.unknown", "Unverified")}
      </span>
      {recommendedSources.has(entry.source) && (
        <span
          className="ml-1 rounded-sm bg-[color-mix(in_srgb,var(--accent)_16%,var(--bg-surface))] px-1.5 py-0.5 text-xs font-semibold text-[var(--accent-text)]"
          data-testid={`content-set-${entry.id}-recommended`}
        >
          {t("content.trust.recommended", "Recommended")}
        </span>
      )}
    </>
  );
}

/** The row heading: title (+ native title) + source/origin badges. */
function ContentSetHeading({
  entry,
  repoMeta,
  recommendedSources,
}: {
  entry: ContentSetEntry;
  repoMeta: RepoMeta;
  recommendedSources: Set<string>;
}) {
  const { t } = useI18n();
  return (
    <h4>
      {entry.title}
      {entry.title_native && entry.title_native !== entry.title && (
        <span className="content-set-native"> · {entry.title_native}</span>
      )}
      <span className="content-set-source" data-testid={`content-set-${entry.id}-source`}>
        {entry.source.startsWith("bundled:")
          ? t("content.source.bundled", "Bundled")
          : t("content.source.github", "GitHub")}
      </span>
      <ContentSetOriginBadges
        entry={entry}
        repoMeta={repoMeta}
        recommendedSources={recommendedSources}
      />
    </h4>
  );
}

/** The language-pair / level / lesson-count line + cached/update tags. */
function ContentSetTags({ entry, isCached }: { entry: ContentSetEntry; isCached: boolean }) {
  const { t } = useI18n();
  return (
    <p className="content-set-tags">
      <span>
        {entry.source_language.toUpperCase()}
        {"→"}
        {entry.target_language.toUpperCase()}
        {" · "}
        {entry.level}
        {" · "}
        {entry.lesson_count} {t("content.lessons", "lessons")}
      </span>
      {isCached && (
        <span className="content-set-cached" data-testid={`content-set-${entry.id}-cached`}>
          {t("content.status.ready", "Ready")} ({entry.cached_version})
        </span>
      )}
      {entry.update_available && (
        <span className="content-set-update" data-testid={`content-set-${entry.id}-update`}>
          {t("content.status.update_available", "Update available")}
        </span>
      )}
    </p>
  );
}

/** Visually-hidden live-region status for the row's download state. */
function ContentSetStatus({
  entry,
  downloadState,
  isCached,
}: {
  entry: ContentSetEntry;
  downloadState: DownloadState;
  isCached: boolean;
}) {
  const { t } = useI18n();
  return (
    <span
      className="sr-only"
      role="status"
      aria-live="polite"
      data-testid={`content-set-${entry.id}-status`}
    >
      {downloadState === "downloading"
        ? t("content.status.downloading", "Downloading…")
        : isCached && !entry.update_available
          ? t("content.status.ready", "Ready")
          : entry.update_available
            ? t("content.status.update_available", "Update available")
            : ""}
    </span>
  );
}

/** The label + icon for the download/update/installed button state. */
function ContentSetDownloadLabel({
  entry,
  downloadState,
  isCached,
}: {
  entry: ContentSetEntry;
  downloadState: DownloadState;
  isCached: boolean;
}) {
  const { t } = useI18n();
  if (downloadState === "downloading") {
    return (
      <>
        <Download size={14} aria-hidden="true" />
        {t("content.status.downloading", "Downloading…")}
      </>
    );
  }
  if (isCached && !entry.update_available) {
    return (
      <>
        <FolderOpen size={14} aria-hidden="true" />
        {t("content.action.installed", "Installed")}
      </>
    );
  }
  if (entry.update_available) {
    return (
      <>
        <Download size={14} aria-hidden="true" />
        {t("content.action.update", "Update")}
      </>
    );
  }
  return (
    <>
      <Download size={14} aria-hidden="true" />
      {t("content.action.download", "Download")}
    </>
  );
}

/** Open (when cached) + Download/Update action buttons. */
function ContentSetActions({
  entry,
  downloadState,
  online,
  isCached,
  onOpen,
  onDownload,
  onAiCheck,
  aiCheckDisabledReason,
  onQualityCheck,
}: {
  entry: ContentSetEntry;
  downloadState: DownloadState;
  online: boolean;
  isCached: boolean;
  onOpen: (entry: ContentSetEntry) => void;
  onDownload: (entry: ContentSetEntry) => void;
  onAiCheck?: (entry: ContentSetEntry) => void;
  aiCheckDisabledReason?: string;
  onQualityCheck?: (entry: ContentSetEntry) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      {isCached && (
        <Button
          type="button"
          className="content-set-open-btn"
          onClick={() => onOpen(entry)}
          data-testid={`content-set-${entry.id}-open`}
        >
          <BookOpen size={14} aria-hidden="true" />
          {t("content.action.open", "Open")}
        </Button>
      )}
      {isCached && onQualityCheck && (
        <Button
          type="button"
          variant="outline"
          className="content-set-quality-btn"
          onClick={() => onQualityCheck(entry)}
          data-testid={`content-set-${entry.id}-quality-check`}
        >
          <ListChecks size={14} aria-hidden="true" />
          {t("content.quality.button", "Quality check")}
        </Button>
      )}
      {isCached && onAiCheck && (
        <Button
          type="button"
          variant="outline"
          className="content-set-aicheck-btn"
          onClick={() => onAiCheck(entry)}
          disabled={!!aiCheckDisabledReason}
          title={aiCheckDisabledReason || undefined}
          data-testid={`content-set-${entry.id}-ai-check`}
        >
          <Sparkles size={14} aria-hidden="true" />
          {t("content.ai_check.button", "Check with AI")}
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        className="content-set-download-btn"
        onClick={() => onDownload(entry)}
        disabled={
          downloadState === "downloading" || (isCached && !entry.update_available) || !online
        }
        title={!online ? t("pwa.action_unavailable", "Not available offline") : undefined}
        data-testid={`content-set-${entry.id}-action`}
      >
        <ContentSetDownloadLabel entry={entry} downloadState={downloadState} isCached={isCached} />
      </Button>
    </>
  );
}

export default function ContentSetRow({
  entry,
  downloadState,
  online,
  repoMeta,
  recommendedSources,
  onOpen,
  onDownload,
  mediaResources = [],
  onOpenMedia,
  onAiCheck,
  aiCheckDisabledReason,
  onQualityCheck,
  aiBadgeStatus = "none",
}: ContentSetRowProps) {
  const { t } = useI18n();
  const isCached = entry.cached_version !== null;
  return (
    <ListRow
      className="content-set-row"
      metaClassName="content-set-meta"
      actionsClassName="content-set-action"
      testId={`content-set-${entry.id}`}
      title={
        <ContentSetHeading
          entry={entry}
          repoMeta={repoMeta}
          recommendedSources={recommendedSources}
        />
      }
      tags={
        <span className="inline-flex flex-wrap items-center">
          <ContentSetTags entry={entry} isCached={isCached} />
          <SetMediaBadges
            resources={mediaResources}
            setId={entry.id}
            onOpen={() => (onOpenMedia ?? onOpen)(entry)}
          />
        </span>
      }
      description={
        entry.description ? <p className="content-set-desc">{entry.description}</p> : undefined
      }
      status={
        <>
          <ContentSetStatus entry={entry} downloadState={downloadState} isCached={isCached} />
          <AiCheckedBadge
            status={aiBadgeStatus}
            verifiedLabel={t("content.ai_check.badge.verified", "AI-checked")}
            staleLabel={t("content.ai_check.badge.stale", "AI-check outdated")}
            invalidLabel={t("content.ai_check.badge.invalid", "AI-check invalid")}
            testId={`content-set-${entry.id}-ai-badge`}
          />
        </>
      }
      actions={
        <ContentSetActions
          entry={entry}
          downloadState={downloadState}
          online={online}
          isCached={isCached}
          onOpen={onOpen}
          onDownload={onDownload}
          onAiCheck={onAiCheck}
          aiCheckDisabledReason={aiCheckDisabledReason}
          onQualityCheck={onQualityCheck}
        />
      }
    />
  );
}
