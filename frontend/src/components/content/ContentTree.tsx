/**
 * The downloaded-sets browse tree on /content (extracted from
 * Content.tsx, #401).
 *
 * Renders the source→target→level hierarchy: a primary section for the
 * learner's spoken language(s), a collapsible "other source languages"
 * section, and a "Knowledge" section for non-language domains (each with
 * a domain icon + book recommendations). Per-set rows are delegated to
 * {@link ContentSetRow}; collapse state and the row actions come from
 * props.
 */

import { Brain, Calculator, ChevronDown, ChevronRight, Code, GraduationCap } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import {
  buildContentTree,
  type FoldedUserLesson,
  type SourceGroup,
  type TargetGroup,
} from "../../lib/content/content-tree";
import { languageDisplayName } from "../../lib/content/language-names";
import { booksForDomain, type BookRecommendations } from "../../lib/content/book-recommendations";
import { mediaForDomain, type MediaResource } from "../../lib/content/media-loader";
import type { ContentSetEntry } from "../../storage/types";
import BookRecommendationsSection from "./BookRecommendations";
import ContentSetRow, { type DownloadState } from "./ContentSetRow";
import type { AiCheckBadgeStatus } from "../../shared/AiCheckedBadge";
import FoldedUserLessons from "./FoldedUserLessons";

/** Per-row state + actions forwarded down to {@link ContentSetRow}. */
export interface ContentSetRowActions {
  perSetState: Record<string, DownloadState>;
  online: boolean;
  repoMeta: Record<string, { trust: number; coach: boolean }>;
  recommendedSources: Set<string>;
  onOpen: (entry: ContentSetEntry) => void;
  onDownload: (entry: ContentSetEntry) => void;
  /** EXP-029 / MED-06 — all media resources (per-domain) for the
   *  media-availability badges; defaults to none. */
  media?: MediaResource[];
  /** Open the set's first lesson focused on its media section
   *  (badge click); defaults to {@link onOpen}. */
  onOpenMedia?: (entry: ContentSetEntry) => void;
  /** EXP-033 / AIV-02 — open the AI content-check dialog for a cached
   *  set. Omit to hide the "Check with AI" button entirely. */
  onAiCheck?: (entry: ContentSetEntry) => void;
  /** When set, the AI-check button is visible but disabled with this
   *  tooltip reason (no key / browser-mode only). */
  aiCheckDisabledReason?: string;
  /** EXP-033 / AIV-11 — resolve the "AI-checked" badge status per set. */
  aiBadgeStatusFor?: (entry: ContentSetEntry) => AiCheckBadgeStatus;
}

/** Actions + lookup for the user lessons folded into tree nodes
 *  (EXP-026 / UGC-04). Omit to render the tree without folding. */
export interface FoldedLessonActions {
  setsByKey: Record<string, ContentSetEntry>;
  communitySharingEnabled: boolean;
  onPlayLesson: (lesson: FoldedUserLesson) => void;
  onEdit: (entry: ContentSetEntry) => void;
  onExportJson: (entry: ContentSetEntry) => void;
  onExportSet: (entry: ContentSetEntry) => void;
  onShare: (entry: ContentSetEntry) => void;
  onDelete: (entry: ContentSetEntry) => void;
}

interface ContentTreeProps {
  tree: ReturnType<typeof buildContentTree>;
  lang: string;
  collapsed: Record<string, boolean>;
  toggleNode: (nodeId: string) => void;
  otherExpanded: boolean;
  setOtherExpanded: (next: boolean | ((prev: boolean) => boolean)) => void;
  bookRecs: BookRecommendations;
  setRow: ContentSetRowActions;
  /** User-lesson folding (EXP-026); omit to render without folding. */
  folded?: FoldedLessonActions;
}

export default function ContentTree({
  tree,
  lang,
  collapsed,
  toggleNode,
  otherExpanded,
  setOtherExpanded,
  bookRecs,
  setRow,
  folded,
}: ContentTreeProps) {
  const { t } = useI18n();

  const renderFolded = (lessons: FoldedUserLesson[]) =>
    folded && lessons.length > 0 ? (
      <FoldedUserLessons
        lessons={lessons}
        setsByKey={folded.setsByKey}
        communitySharingEnabled={folded.communitySharingEnabled}
        onPlayLesson={folded.onPlayLesson}
        onEdit={folded.onEdit}
        onExportJson={folded.onExportJson}
        onExportSet={folded.onExportSet}
        onShare={folded.onShare}
        onDelete={folded.onDelete}
      />
    ) : null;

  const renderSetRow = (entry: ContentSetEntry) => (
    <ContentSetRow
      key={`${entry.source}#${entry.id}`}
      entry={entry}
      downloadState={setRow.perSetState[`${entry.source}#${entry.id}`] ?? "idle"}
      online={setRow.online}
      repoMeta={setRow.repoMeta}
      recommendedSources={setRow.recommendedSources}
      onOpen={setRow.onOpen}
      onDownload={setRow.onDownload}
      mediaResources={mediaForDomain(setRow.media ?? [], entry.domain)}
      onOpenMedia={setRow.onOpenMedia}
      onAiCheck={setRow.onAiCheck}
      aiCheckDisabledReason={setRow.aiCheckDisabledReason}
      aiBadgeStatus={setRow.aiBadgeStatusFor?.(entry) ?? "none"}
    />
  );

  const renderTargetGroup = (sourceLang: string, group: TargetGroup) => {
    const nodeId = `${sourceLang}/${group.targetLanguage}`;
    // Primary target groups default open; collapse only when the
    // user explicitly toggled this node closed.
    const isCollapsed = collapsed[nodeId] === true;
    const targetName = languageDisplayName(group.targetLanguage, lang);
    return (
      <div key={nodeId} className="content-target-group" data-testid={`content-target-${nodeId}`}>
        <button
          type="button"
          className="content-tree-toggle"
          onClick={() => toggleNode(nodeId)}
          aria-expanded={!isCollapsed}
          data-testid={`content-target-${nodeId}-toggle`}
        >
          {isCollapsed ? (
            <ChevronRight size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
          <span className="content-tree-label">
            {t("content.tree.learn", "Learn {lang}").replace("{lang}", targetName)} (
            {group.targetLanguage.toUpperCase()})
          </span>
          <span className="content-tree-count">
            {group.setCount} {t("content.tree.sets", "sets")}
          </span>
        </button>
        {!isCollapsed && (
          <div className="content-target-body">
            {group.levels.map((levelGroup) => (
              <div
                key={levelGroup.level}
                className="content-level-group"
                data-testid={`content-level-${nodeId}-${levelGroup.level}`}
              >
                <h3 className="content-level-title">
                  {levelGroup.level} · {levelGroup.sets.length} {t("content.lessons", "lessons")}
                  {levelGroup.userLessons.length > 0 && (
                    <span className="content-level-own-count" data-testid={`content-level-${nodeId}-${levelGroup.level}-own-count`}>
                      {" ("}
                      {t("content.tree.plus_own", "+{n} own").replace(
                        "{n}",
                        String(levelGroup.userLessons.length),
                      )}
                      {")"}
                    </span>
                  )}
                </h3>
                <ul className="content-set-list">
                  {levelGroup.sets.map((entry) => renderSetRow(entry))}
                </ul>
                {renderFolded(levelGroup.userLessons)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSourceTargets = (group: SourceGroup) =>
    group.targets.map((target) => renderTargetGroup(group.sourceLanguage, target));

  // Domain icon for the knowledge ("Wissen") section. Unknown domains
  // fall back to a graduation-cap glyph.
  const domainIcon = (domain: string) => {
    if (domain === "programming") return <Code size={16} aria-hidden="true" />;
    if (domain === "psychology") return <Brain size={16} aria-hidden="true" />;
    if (domain === "math") return <Calculator size={16} aria-hidden="true" />;
    return <GraduationCap size={16} aria-hidden="true" />;
  };

  const domainLabel = (domain: string) =>
    t(`content.tree.domain_${domain}`, domain.charAt(0).toUpperCase() + domain.slice(1));

  return (
    <div className="content-tree" data-testid="content-tree">
      {/* Primary: the source language(s) the learner speaks. */}
      {tree.primary.length > 0 && (
        <section className="content-source-primary" data-testid="content-source-primary">
          <h2 className="content-source-heading">
            {t("content.tree.i_speak", "I speak")}:{" "}
            {tree.primary.map((g) => languageDisplayName(g.sourceLanguage, lang)).join(", ")}
          </h2>
          {tree.primary.map((group) => (
            <div key={group.sourceLanguage} data-testid={`content-source-${group.sourceLanguage}`}>
              {tree.primary.length > 1 && (
                <h3 className="content-source-sub">
                  {languageDisplayName(group.sourceLanguage, lang)}
                </h3>
              )}
              {renderSourceTargets(group)}
            </div>
          ))}
        </section>
      )}

      {tree.primary.length === 0 && (
        <p className="content-empty" data-testid="content-no-primary">
          {t(
            "content.tree.no_primary",
            "No sets for your language yet. Browse other source languages below.",
          )}
        </p>
      )}

      {/* Other source languages — collapsed by default. */}
      {tree.other.length > 0 && (
        <section className="content-source-other" data-testid="content-source-other">
          <button
            type="button"
            className="content-tree-toggle content-other-toggle"
            onClick={() => setOtherExpanded((v) => !v)}
            aria-expanded={otherExpanded}
            data-testid="content-other-toggle"
          >
            {otherExpanded ? (
              <ChevronDown size={16} aria-hidden="true" />
            ) : (
              <ChevronRight size={16} aria-hidden="true" />
            )}
            <span className="content-tree-label">
              {t("content.tree.other_sources", "Other source languages")}
            </span>
            <span className="content-tree-count">{tree.other.length}</span>
          </button>
          {otherExpanded && (
            <div className="content-other-body">
              {tree.other.map((group) => (
                <div
                  key={group.sourceLanguage}
                  data-testid={`content-source-${group.sourceLanguage}`}
                >
                  <h3 className="content-source-sub">
                    {t("content.tree.for_speakers", "For {lang} speakers").replace(
                      "{lang}",
                      languageDisplayName(group.sourceLanguage, lang),
                    )}
                  </h3>
                  {renderSourceTargets(group)}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* v1.3 — Knowledge ("Wissen"): non-language domain sets,
      grouped by domain with a domain-specific icon. */}
      {tree.knowledge.length > 0 && (
        <section className="content-source-knowledge" data-testid="content-knowledge">
          <h2 className="content-source-heading">{t("content.tree.knowledge", "Knowledge")}</h2>
          {tree.knowledge.map((group) => (
            <div key={group.domain} data-testid={`content-domain-${group.domain}`}>
              <h3 className="content-source-sub content-domain-sub">
                {domainIcon(group.domain)} {domainLabel(group.domain)}
                {group.userLessons.length > 0 && (
                  <span
                    className="content-level-own-count"
                    data-testid={`content-domain-${group.domain}-own-count`}
                  >
                    {" ("}
                    {t("content.tree.plus_own", "+{n} own").replace(
                      "{n}",
                      String(group.userLessons.length),
                    )}
                    {")"}
                  </span>
                )}
              </h3>
              {/* renderSetRow returns a <li>; the knowledge groups
                  must wrap them in a list like the language sets do
                  (#273, axe listitem — a listitem must be contained
                  in a <ul>/<ol>). */}
              <ul className="content-set-list">{group.sets.map((entry) => renderSetRow(entry))}</ul>
              {renderFolded(group.userLessons)}
              <BookRecommendationsSection
                domain={group.domain}
                books={booksForDomain(bookRecs, group.domain)}
              />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
