/**
 * One downloaded content-set row in the /content browse tree
 * (extracted from Content.tsx, #401).
 *
 * Renders the set's title + source/trust/recommended badges, the
 * language-pair / level / lesson-count tags, the cached + update
 * status, and the per-row Open / Download action. Pure presentation —
 * all state and actions come from props.
 */

import { BookOpen, Download, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../hooks/useI18n";
import { isOfficialSource } from "../../lib/content/content-repos";
import type { ContentSetEntry } from "../../storage/types";

export type DownloadState = "idle" | "downloading" | "done" | "error";

interface ContentSetRowProps {
  entry: ContentSetEntry;
  downloadState: DownloadState;
  online: boolean;
  repoMeta: Record<string, { trust: number; coach: boolean }>;
  recommendedSources: Set<string>;
  onOpen: (entry: ContentSetEntry) => void;
  onDownload: (entry: ContentSetEntry) => void;
}

export default function ContentSetRow({
  entry,
  downloadState,
  online,
  repoMeta,
  recommendedSources,
  onOpen,
  onDownload,
}: ContentSetRowProps) {
  const { t } = useI18n();
  const isCached = entry.cached_version !== null;
  return (
    <li className="content-set-row" data-testid={`content-set-${entry.id}`}>
      <div className="content-set-meta">
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
          {!isOfficialSource(entry.source) && (
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
                  repoMeta[entry.source]?.trust === 1
                    ? "ml-1 rounded-sm bg-[var(--success-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--success)]"
                    : "ml-1 rounded-sm bg-[var(--warning-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--warning)]"
                }
                data-testid={`content-set-${entry.id}-trust`}
              >
                {repoMeta[entry.source]?.trust === 1
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
          )}
        </h4>
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
        {entry.description && <p className="content-set-desc">{entry.description}</p>}
      </div>
      <div className="content-set-action">
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
          {downloadState === "downloading" ? (
            <>
              <Download size={14} aria-hidden="true" />
              {t("content.status.downloading", "Downloading…")}
            </>
          ) : isCached && !entry.update_available ? (
            <>
              <FolderOpen size={14} aria-hidden="true" />
              {t("content.action.installed", "Installed")}
            </>
          ) : entry.update_available ? (
            <>
              <Download size={14} aria-hidden="true" />
              {t("content.action.update", "Update")}
            </>
          ) : (
            <>
              <Download size={14} aria-hidden="true" />
              {t("content.action.download", "Download")}
            </>
          )}
        </Button>
      </div>
    </li>
  );
}
