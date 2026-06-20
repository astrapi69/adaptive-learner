/**
 * /content — Set Browser page (Phase 43 / EXP-002 / F-100 + F-101).
 *
 * Lists every content set the configured sources publish, plus
 * every cached set the user has downloaded. Each row renders:
 * title / language / level / lesson count / download status
 * (not downloaded | downloading | ready | update available) +
 * a single primary action button per row.
 *
 * Storage-mode-agnostic: routes every call through
 * ``getStorage().contentLoader.*`` so the same page works in
 * API mode (backend orchestrator) and Dexie mode (in-browser
 * fetch + IndexedDB cache).
 *
 * This page is the layout shell: it loads the sets (via
 * {@link useContentSetsData}), owns the search + Continue Learning +
 * contributions, and composes the extracted sections — the
 * {@link ContentToolbar}, {@link ContentSearchResults},
 * {@link ContentGapsSection}, {@link MyLessonsSection},
 * {@link ContentTree}, {@link DeleteLessonModal}, and
 * {@link ContentShareDialog} (backed by {@link useContentSharing}).
 * Set-level handlers live in {@link useContentSetActions}.
 */

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import ContinueLearning from "../../components/ContinueLearning";
import ImportLessonModal from "../../components/content/ImportLessonModal";
import MyLessonsSection from "../../components/content/MyLessonsSection";
import ContentTree from "../../components/content/ContentTree";
import ContentShareDialog from "../../components/content/ContentShareDialog";
import ContentBookCompanions from "../../components/content/ContentBookCompanions";
import ContentContributionsSection from "../../components/content/ContentContributionsSection";
import ContentToolbar from "../../components/content/ContentToolbar";
import ContentSearchResults from "../../components/content/ContentSearchResults";
import ContentGapsSection from "../../components/content/ContentGapsSection";
import DeleteLessonModal from "../../components/content/DeleteLessonModal";
import { useContentSearch } from "../../hooks/content/useContentSearch";
import { useContentSharing } from "../../hooks/content/useContentSharing";
import { useContentSetsData } from "../../hooks/content/useContentSetsData";
import { useContentSetActions } from "../../hooks/content/useContentSetActions";
import { useI18n } from "../../hooks/ui/useI18n";
import { useOnlineStatus } from "../../hooks/system/useOnlineStatus";
import { useSourceLanguages } from "../../hooks/settings/useSourceLanguages";
import {
  buildContentTree,
  type FoldedUserLesson,
} from "../../lib/content/content-tree";
import { computeUserFold } from "../../lib/content/user-fold";
import { resolveAiCheckDisabledReason } from "../../lib/content/ai-check-gate";
import {
  listContributions,
  recordContribution,
} from "../../lib/content/contribution-history";
import { useApiKeyStatus } from "../../hooks/settings/useApiKeyStatus";
import { readLearnerState } from "../../lib/learnerState";
import { resolveStorageMode } from "../../storage";
import AiValidationDialog from "../../components/content/AiValidationDialog";
import QualityCheckDialog from "../../components/content/QualityCheckDialog";
import type { AiCheckBadgeStatus } from "../../shared/status/AiCheckedBadge";
import { USER_GENERATED_SOURCE } from "../../storage/types";
import { isOfficialSource } from "../../lib/content/content-repos";
import type { ContentSetEntry } from "../../storage/types";

/** Community contribution target repo (manual maintainer review). */
const COMMUNITY_REPO = "astrapi69/adaptive-learner-content";
const COMMUNITY_BRANCH = "main";

/** "Share with Community" opens a GitHub pull request against
 *  COMMUNITY_REPO (the lesson JSON lands at the correct tree path and
 *  the repo CI validates it automatically). Enabled now that the
 *  content repo exists; set false to gate the button off again (e.g.
 *  if the repo is unavailable). Export (JSON / ZIP) is independent of
 *  this — it's a local download. */
const COMMUNITY_SHARING_ENABLED = true;

export default function ContentPage() {
  const { t, lang } = useI18n();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const data = useContentSetsData();
  const {
    sets,
    setSets,
    sources,
    loading,
    refreshing,
    loadSets,
    handleRefresh,
    bookRecs,
    media,
    bookCompanions,
    perSetState,
    setPerSetState,
    userLessonsBySet,
    repoMeta,
    recommendedSources,
    contributions,
    setContributions,
    aiBadgeBySet,
  } = data;

  // Phase 59E — import-lesson modal.
  const [showImport, setShowImport] = useState(false);
  // Phase 60 — source-language tree: the learner's active source
  // languages (app language + opted-in extras) rank the tree.
  const { active: activeSources } = useSourceLanguages();
  // Collapsed/expanded state per tree node (keyed by node id).
  // Primary target groups default open; the "other source
  // languages" section defaults collapsed.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleNode = (nodeId: string) =>
    setCollapsed((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  // "Other source languages" section is collapsed by default.
  const [otherExpanded, setOtherExpanded] = useState(false);
  // EXP-023 Phase B — source filter: "all" / "official" / a specific
  // user-repo source ("owner/repo").
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const { hasKey, activeProvider } = useApiKeyStatus();
  const userId = readLearnerState().userId;

  // EXP-033 / AIV-02 — set-wide AI content check. The trigger is gated to
  // Dexie mode (browser-direct provider call; no server route) + a
  // configured key; the button stays visible-but-disabled otherwise.
  const [aiCheckTarget, setAiCheckTarget] = useState<ContentSetEntry | null>(null);
  // EXP-032 — deterministic, offline content-quality check (no key/mode gate).
  const [qualityCheckTarget, setQualityCheckTarget] =
    useState<ContentSetEntry | null>(null);
  const aiCheckIsDexie = resolveStorageMode() === "dexie";
  const aiCheckDisabledReason = resolveAiCheckDisabledReason(t, aiCheckIsDexie, hasKey);

  // --- Content Browser search (#354 — extracted to useContentSearch) ---
  const {
    searchQuery,
    setSearchQuery,
    activateSearch,
    searchInputRef,
    searchResult,
  } = useContentSearch(sets);

  const {
    deleteTarget,
    setDeleteTarget,
    deleting,
    openLessonFile,
    handleOpenLesson,
    handleEditUserSet,
    handleDeleteUserSet,
    handleExportJson,
    handleExportSet,
    fetchSetLessons,
    handleDownload,
  } = useContentSetActions({ navigate, setSets, setPerSetState });

  // Phase 60 — community-share + opt-in AI validation (extracted to
  // useContentSharing). The page keeps the contribution history.
  const share = useContentSharing({ sets, fetchSetLessons });

  const recordShare = (url: string, title: string) => {
    if (!share.shareTarget) return;
    recordContribution({
      lesson_id: share.shareTarget.id,
      title,
      shared_at: new Date().toISOString(),
      github_url: url,
      status: "submitted",
    });
    setContributions(listContributions());
  };

  if (loading) {
    return (
      <main id="main" className="page content-page" data-testid="content-loading">
        <p>{t("content.loading", "Loading content sets…")}</p>
      </main>
    );
  }

  // Phase 59C — user-generated lessons ("My Lessons") render in
  // their own section, separate from downloaded content sets.
  const userSets = sets.filter((s) => s.source === USER_GENERATED_SOURCE);
  const downloadedSets = sets.filter((s) => s.source !== USER_GENERATED_SOURCE);

  // Phase 60 — group downloaded sets into the source -> target ->
  // level tree, ranked by the learner's active source languages.
  // EXP-023 Phase A — when a user repo is connected, offer a source
  // filter (Alle / Offiziell / Eigenes Repo) over the tree.
  const userRepoSources = [
    ...new Set(downloadedSets.filter((s) => !isOfficialSource(s.source)).map((s) => s.source)),
  ];
  const hasUserRepoSets = userRepoSources.length > 0;
  const visibleSets = downloadedSets.filter((s) => {
    if (sourceFilter === "all") return true;
    if (sourceFilter === "official") return isOfficialSource(s.source);
    return s.source === sourceFilter;
  });

  // EXP-026 / UGC-04 — fold user-generated sets into the matching
  // published node (pure helper extracted in #541 to keep this component
  // under the complexity gate). Matched sets leave the My Lessons
  // fallback (decision E4); unmatched ones stay.
  const { matchedFold, unmatchedUserSets, userSetsByKey } = computeUserFold(
    userSets,
    visibleSets,
    userLessonsBySet,
  );
  const tree = buildContentTree(visibleSets, activeSources, matchedFold);

  const handlePlayFolded = (lesson: FoldedUserLesson) =>
    openLessonFile(lesson.setSource, lesson.setId, lesson.filename);

  return (
    <main id="main" className="page content-page" data-testid="content-page">
      <header className="content-header">
        <h1>{t("content.page_title", "Content sets")}</h1>
        <button
          type="button"
          className="content-refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          data-testid="content-refresh"
          aria-label={t("content.action.refresh", "Refresh")}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {refreshing
            ? t("content.action.refreshing", "Refreshing…")
            : t("content.action.refresh", "Refresh")}
        </button>
      </header>
      <p className="content-intro">
        {t(
          "content.intro",
          "Pre-built lesson sets you can use without an API key. Downloads are cached locally and work offline after the first fetch.",
        )}
      </p>

      {sources.length > 0 && (
        <p className="content-sources" data-testid="content-sources">
          {t("content.sources", "Sources")}:{" "}
          {sources.map((src) => `${src.source} @ ${src.branch}`).join(", ")}
        </p>
      )}

      {/* EXP-025 / AUTH-02 — book-companion headers for connected repos
          that accompany a published book. Hidden while searching. */}
      {!searchResult.active && <ContentBookCompanions companions={bookCompanions} />}

      {/* UX overhaul C1 — compact toolbar: search FIRST (full width),
          then icon-only action buttons (icon + label from md up). */}
      <ContentToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activateSearch={activateSearch}
        searchInputRef={searchInputRef}
        onImportLesson={() => setShowImport(true)}
        navigate={navigate}
      />

      {/* #772 — the Content Browser is "Meine Inhalte": only locally
          downloaded sets. Discovering new (not-downloaded) content happens on
          /discover; a persistent hint points there while browsing. */}
      {!searchResult.active && (
        <p className="mb-4 text-sm text-muted-foreground" data-testid="content-discover-hint">
          <Link to="/content?tab=discover" className="text-accent hover:underline">
            {t("content.discover_more", "Find more content")} →
          </Link>
        </p>
      )}

      {/* UX overhaul C3 — Continue Learning: the learner's recent
          activity, directly below the search, above the tree. Hidden
          while a search is active (results replace the browse view)
          and when there is no recent activity (the tree covers
          discovery). */}
      {!searchResult.active && userId && (
        <div className="mb-4">
          <ContinueLearning userId={userId} maxItems={5} showWhenEmpty={false} />
        </div>
      )}

      {/* Phase 59C — My Lessons (user-generated sets). Hidden while a
          search is active (results replace the browse view). EXP-026 /
          UGC-04: only the sets that did NOT fold into the tree remain
          here, and the section hides entirely when none do (E4). */}
      {!searchResult.active && unmatchedUserSets.length > 0 && (
        <MyLessonsSection
          userSets={unmatchedUserSets}
          communitySharingEnabled={COMMUNITY_SHARING_ENABLED}
          onOpen={(e) => void handleOpenLesson(e)}
          onEdit={handleEditUserSet}
          onExportJson={(e) => void handleExportJson(e)}
          onExportSet={(e) => void handleExportSet(e)}
          onShare={(e) => void share.handleShare(e)}
          onDelete={setDeleteTarget}
        />
      )}

      {/* Phase 64D — My Contributions (local sharing history). */}
      {!searchResult.active && (
        <ContentContributionsSection contributions={contributions} />
      )}

      {searchResult.active ? (
        <ContentSearchResults
          searchResult={searchResult}
          downloadedSets={downloadedSets}
          openLessonFile={openLessonFile}
        />
      ) : (
        <>
          {/* Phase 64E — encouraging gap suggestions ("Can you help?"). */}
          <ContentGapsSection
            downloadedSets={downloadedSets}
            lang={lang}
            communityRepo={COMMUNITY_REPO}
          />

          <h2 className="content-section-title">
            {t("content.my_lessons.downloaded_title", "Downloaded sets")}
          </h2>
          {hasUserRepoSets && (
            <div
              className="mb-3 flex flex-wrap items-center gap-1"
              role="group"
              aria-label={t("content.filter.aria", "Filter by source")}
              data-testid="content-source-filter"
            >
              {[
                ["all", t("content.filter.all", "All")] as [string, string],
                ["official", t("content.filter.official", "Official")] as [string, string],
                ...userRepoSources.map((src) => [src, src] as [string, string]),
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={sourceFilter === value ? "default" : "outline"}
                  className="min-h-11"
                  aria-pressed={sourceFilter === value}
                  onClick={() => setSourceFilter(value)}
                  data-testid={`content-source-filter-${value}`}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
          {downloadedSets.length === 0 ? (
            <p className="content-empty" data-testid="content-empty">
              {t(
                "content.empty",
                "No content sets available yet. Check your network connection and refresh, or configure a source in Settings.",
              )}
            </p>
          ) : (
            <ContentTree
              tree={tree}
              lang={lang}
              collapsed={collapsed}
              toggleNode={toggleNode}
              otherExpanded={otherExpanded}
              setOtherExpanded={setOtherExpanded}
              bookRecs={bookRecs}
              setRow={{
                perSetState,
                online,
                repoMeta,
                recommendedSources,
                onOpen: (e) => void handleOpenLesson(e),
                onDownload: (e) => void handleDownload(e),
                media,
                onOpenMedia: (e) =>
                  void handleOpenLesson(e, { focusResources: true }),
                onAiCheck: (e) => setAiCheckTarget(e),
                aiCheckDisabledReason,
                onQualityCheck: (e) => setQualityCheckTarget(e),
                aiBadgeStatusFor: (e): AiCheckBadgeStatus =>
                  aiBadgeBySet[`${e.source}#${e.id}`] ?? "none",
              }}
              folded={{
                setsByKey: userSetsByKey,
                communitySharingEnabled: COMMUNITY_SHARING_ENABLED,
                onPlayLesson: handlePlayFolded,
                onEdit: handleEditUserSet,
                onExportJson: (e) => void handleExportJson(e),
                onExportSet: (e) => void handleExportSet(e),
                onShare: (e) => void share.handleShare(e),
                onDelete: setDeleteTarget,
              }}
            />
          )}
        </>
      )}

      <AiValidationDialog
        entry={aiCheckTarget}
        activeProvider={activeProvider ?? null}
        onClose={() => setAiCheckTarget(null)}
      />

      <QualityCheckDialog
        entry={qualityCheckTarget}
        onClose={() => setQualityCheckTarget(null)}
      />

      <ImportLessonModal
        open={showImport}
        onCancel={() => setShowImport(false)}
        onImported={() => {
          setShowImport(false);
          void loadSets();
        }}
      />

      <ContentShareDialog
        share={share}
        knownSets={downloadedSets}
        repo={COMMUNITY_REPO}
        branch={COMMUNITY_BRANCH}
        hasKey={hasKey}
        activeProvider={activeProvider ?? null}
        navigate={navigate}
        onEditUserSet={handleEditUserSet}
        onShared={recordShare}
      />

      <DeleteLessonModal
        target={deleteTarget}
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteUserSet}
      />
    </main>
  );
}
