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
import { Checkbox } from "@/components/ui/checkbox";

import ListRow from "../../../shared/layout/ListRow";
import AiCheckedBadge, { type AiCheckBadgeStatus } from "../../../shared/status/AiCheckedBadge";
import { useI18n } from "../../../hooks/ui/useI18n";
import {
  isOfficialSource,
  resolveRepoCategory,
} from "../../../lib/content/repos/content-repos";
import RepoCategoryBadge from "../RepoCategoryBadge";
import type { MediaResource } from "../../../lib/content/media/media-loader";
import type { ContentSetEntry, SetStatus } from "../../../storage/types";
import DownloadedAtReadout from "../../dev/DownloadedAtReadout";
import SetActionsMenu from "./SetActionsMenu";
import SetShareButton from "../share/SetShareButton";
import SetMediaBadges from "../media/SetMediaBadges";

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
  /** #1300 — change the set's lifecycle status. Omit (with onDelete) to
   *  hide the per-set overflow menu. */
  onSetStatus?: (entry: ContentSetEntry, status: SetStatus) => void;
  /** #1300 — open the delete-confirm dialog for the set. */
  onDelete?: (entry: ContentSetEntry) => void;
  /** #1351 — multi-select: show a selection checkbox on the tile. */
  selectable?: boolean;
  /** #1351 — whether this tile is currently selected. */
  selected?: boolean;
  /** #1351 — toggle this tile's selection. */
  onToggleSelect?: (entry: ContentSetEntry) => void;
}

/** Unified category badge for a non-official source (#1405, rest of #1319):
 *  ONE shared {@link RepoCategoryBadge} (official / private / validated /
 *  unverified via ``resolveRepoCategory``) replaces the pre-#1319 inline
 *  origin/trust/recommended spans. Official-source sets stay badge-free —
 *  they already carry the Bundled/GitHub source tag. */
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
  const meta = repoMeta[entry.source];
  return (
    <RepoCategoryBadge
      category={resolveRepoCategory({
        source: entry.source,
        trust: meta?.trust === 1 ? 1 : 0,
        coach: meta?.coach,
        recommended: recommendedSources.has(entry.source),
      })}
      t={t}
      testId={`content-set-${entry.id}-category`}
      className="ml-1 shrink-0"
    />
  );
}

/** The row heading: title (+ native title) + source/origin badges.
 *
 *  #1392 — the heading is a shrinkable (``min-w-0``) flex row: the title
 *  text truncates with an ellipsis (full name via native tooltip) while
 *  the badges stay ``shrink-0`` (wrapping to the next line when the tile
 *  is too narrow for all of them), so no title length can push a badge
 *  or the actions column out of the tile. */
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
    <h4 className="flex min-w-0 flex-wrap items-center">
      <span className="min-w-0 truncate" title={entry.title}>
        {entry.title}
        {entry.title_native && entry.title_native !== entry.title && (
          <span className="content-set-native"> · {entry.title_native}</span>
        )}
      </span>
      <span
        className="content-set-source shrink-0"
        data-testid={`content-set-${entry.id}-source`}
      >
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
  onSetStatus,
  onDelete,
  selectable,
  selected = false,
  onToggleSelect,
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
        <span className="flex items-center gap-1">
          {selectable && (
            <label className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
              <span className="sr-only">
                {t("content.set_status.select_set", "Select {title}").replace(
                  "{title}",
                  entry.title,
                )}
              </span>
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect?.(entry)}
                aria-label={t("content.set_status.select_set", "Select {title}").replace(
                  "{title}",
                  entry.title,
                )}
                data-testid={`content-select-${entry.id}`}
              />
            </label>
          )}
          <ContentSetHeading
            entry={entry}
            repoMeta={repoMeta}
            recommendedSources={recommendedSources}
          />
        </span>
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
        <>
          {entry.description && <p className="content-set-desc">{entry.description}</p>}
          {/* #1298 — the Dev-Mode download-date diagnostic (the #1259 readout,
              extended from the Learning Path SetRow to "Meine Inhalte"). */}
          <DownloadedAtReadout
            downloadedAt={entry.downloaded_at}
            testId={`content-set-${entry.id}-downloaded-at`}
            className="block"
          />
        </>
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
        <>
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
          {/* #1572 — per-set Share (deep link + QR). */}
          <SetShareButton entry={entry} />
          {/* #1300 — per-set status + delete overflow menu (cached sets
              only; same component as the list view). */}
          {isCached && onSetStatus && onDelete && (
            <SetActionsMenu
              entry={entry}
              status={entry.status ?? "active"}
              onSetStatus={(status) => onSetStatus(entry, status)}
              onDelete={() => onDelete(entry)}
            />
          )}
        </>
      }
    />
  );
}
