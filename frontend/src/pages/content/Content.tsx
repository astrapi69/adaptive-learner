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
 * {@link ContentSearchBar}, {@link ContentSearchResults},
 * {@link ContentTree}, {@link DeleteLessonModal}, and
 * {@link ContentShareDialog} (backed by {@link useContentSharing}).
 * Set-level handlers live in {@link useContentSetActions}.
 *
 * #1253 — the import/creation action buttons and the standalone
 * "My Lessons" section moved to the Import tab
 * ({@link ImportActionsPanel}); this page keeps the search, the
 * downloaded-set tree (with EXP-026 folded user lessons), and
 * Continue Learning.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import PageContainer from "../../shared/layout/PageContainer";
import { useInfoHint } from "../../shared/feedback/useInfoHint";
import ContentBrowsePanel from "../../components/content/browser/ContentBrowsePanel";
import ContentPageHeader from "../../components/content/browser/ContentPageHeader";
import ContentShareDialog from "../../components/content/share/ContentShareDialog";
import ContentBookCompanions from "../../components/content/media/ContentBookCompanions";
import ContentContributionsSection from "../../components/content/contributions/ContentContributionsSection";
import ContentSearchBar from "../../components/content/browser/ContentSearchBar";
import FilterMenuButton from "../../shared/forms/FilterMenuButton";
import ContentSearchResults from "../../components/content/browser/ContentSearchResults";
import { setSelectionKey } from "../../components/content/browser/ContentSetListView";
import DeleteSetModal from "../../components/content/browser/DeleteSetModal";
import BulkDeleteSetsModal from "../../components/content/browser/BulkDeleteSetsModal";
import DeleteLessonModal from "../../components/content/lessons/DeleteLessonModal";
import { useContentFilters } from "../../hooks/content/browse";
import { useContentSearch } from "../../hooks/content/useContentSearch";
import { useContentSharing } from "../../hooks/content/useContentSharing";
import { useContentSetsData } from "../../hooks/content/useContentSetsData";
import { useContentSetActions } from "../../hooks/content/useContentSetActions";
import { useSetSelection } from "../../hooks/content/useSetSelection";
import { useContentViewMode } from "../../hooks/content/useContentViewMode";
import { useI18n } from "../../hooks/ui/useI18n";
import { useOnlineStatus } from "../../hooks/system/useOnlineStatus";
import { useSourceLanguages } from "../../hooks/settings/useSourceLanguages";
import {
  buildContentTree,
  type FoldedUserLesson,
} from "../../lib/content/browse/content-tree";
import { computeUserFold } from "../../lib/content/browse/user-fold";
import { resolveAiCheckDisabledReason } from "../../lib/content/validation/ai-check-gate";
import {
  listContributions,
  recordContribution,
} from "../../lib/content/placement/contribution-history";
import { useApiKeyStatus } from "../../hooks/settings/useApiKeyStatus";
import { resolveStorageMode } from "../../storage";
import AiValidationDialog from "../../components/content/quality/AiValidationDialog";
import QualityCheckDialog from "../../components/content/quality/QualityCheckDialog";
import type { AiCheckBadgeStatus } from "../../shared/status/AiCheckedBadge";
import { USER_GENERATED_SOURCE } from "../../storage/types";
import { type StatusFilter } from "../../lib/content/browse/set-status-filter";
import type { ContentSetEntry, SetStatus } from "../../storage/types";

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
  // #1240 — grid (rich tree) ⇄ list (compact) view. Default grid;
  // persisted across navigation/reload.
  const [viewMode, setViewMode] = useContentViewMode();

  const { hasKey, activeProvider } = useApiKeyStatus();

  // #1272 — the header info button reveals the intro prose AND the
  // (dynamic) configured-sources line in one expandable panel below the
  // header, instead of a permanent sources line.
  const headerInfo = useInfoHint("content_my");

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
    deleteSetTarget,
    setDeleteSetTarget,
    deletingSet,
    handleSetStatus,
    handleConfirmDeleteSet,
    bulkDeleteTargets,
    setBulkDeleteTargets,
    bulkDeleting,
    handleBulkSetStatus,
    handleConfirmBulkDelete,
    openLessonFile,
    handleOpenLesson,
    handleEditUserSet,
    handleDeleteUserSet,
    handleExportJson,
    handleExportSet,
    fetchSetLessons,
    handleDownload,
  } = useContentSetActions({ navigate, setSets, setPerSetState });

  // #1351 — multi-select state for the bulk-action bar.
  const selection = useSetSelection();

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

  // Phase 59C — user-generated lessons ("My Lessons") render in
  // their own section, separate from downloaded content sets.
  const userSets = sets.filter((s) => s.source === USER_GENERATED_SOURCE);
  const downloadedSets = sets.filter((s) => s.source !== USER_GENERATED_SOURCE);

  // Filter state + every derived projection (status/source menus,
  // visibleSets, the #1386 search-AND-filter) live in the extracted
  // hook (#1793).
  const filters = useContentFilters({ t, sets, downloadedSets, searchResult });
  const { visibleSets, filteredSearchResult } = filters;

  if (loading) {
    return (
      <PageContainer testId="content-loading">
        <p>{t("content.loading", "Loading content sets…")}</p>
      </PageContainer>
    );
  }

  // #1351 — multi-select derives from the currently VISIBLE (filtered) sets:
  // "select all" only ever covers what the learner can see, never silently
  // more. The selected entries drive the bulk actions.
  const selectedEntries = visibleSets.filter((s) =>
    selection.isSelected(setSelectionKey(s)),
  );
  const bulkStatus = (status: SetStatus) => {
    void handleBulkSetStatus(selectedEntries, status);
    selection.clear();
  };
  const bulkDeleteCount = bulkDeleteTargets?.length ?? 0;

  // EXP-026 / UGC-04 — fold user-generated sets into the matching
  // published node (pure helper extracted in #541 to keep this component
  // under the complexity gate). Matched sets leave the My Lessons
  // fallback (decision E4); unmatched ones stay.
  const { matchedFold, userSetsByKey } = computeUserFold(
    userSets,
    visibleSets,
    userLessonsBySet,
  );
  const tree = buildContentTree(visibleSets, activeSources, matchedFold);

  const handlePlayFolded = (lesson: FoldedUserLesson) =>
    openLessonFile(lesson.setSource, lesson.setId, lesson.filename);

  return (
    <PageContainer testId="content-page">
      <ContentPageHeader
        headerInfo={headerInfo}
        sources={sources}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* EXP-025 / AUTH-02 — book-companion headers for connected repos
          that accompany a published book. Hidden while searching. */}
      {!searchResult.active && <ContentBookCompanions companions={bookCompanions} />}

      {/* #1253 — search bar only. The import/creation action buttons
          moved to the Import tab (ImportActionsPanel). */}
      <ContentSearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activateSearch={activateSearch}
        searchInputRef={searchInputRef}
      />

      {/* #1386 — status + source as two compact menu buttons (the
          SetActionsMenu pattern; never a native select). Rendered above
          BOTH the browse tree and the search results, because the search
          combines with the filters as AND — never filter silently. */}
      {downloadedSets.length > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2"
          data-testid="content-filter-bar"
        >
          <FilterMenuButton
            label={t("content.filter_menu.status", "Status")}
            options={filters.statusOptions}
            value={filters.statusFilter}
            onChange={(value) => filters.setStatusFilter(value as StatusFilter)}
            testId="content-status-filter"
          />
          <FilterMenuButton
            label={t("content.filter_menu.source", "Source")}
            options={filters.sourceOptions}
            value={filters.sourceFilter}
            onChange={filters.setSourceFilter}
            testId="content-source-filter"
          />
        </div>
      )}

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

      {/* #1269 — Continue Learning ("Weitermachen") removed from the
          content tab: it displaced the downloaded sets and duplicated the
          Dashboard, which is its home. The component itself stays for the
          Dashboard; only this embedding is gone. */}

      {/* #1253 — the standalone "My Lessons" section (unmatched
          user-generated sets) moved to the Import tab
          (ImportActionsPanel). EXP-026 folded user lessons stay in the
          downloaded-set tree below. */}

      {/* Phase 64D — My Contributions (local sharing history). This shows
          the user's OWN shared lessons (person-relevant). #1504 removed the
          dynamic "Missing Lessons" gap block that used to sit here: it
          surfaced language pairs unrelated to the learner. Helping the
          library grow is now a static block in Settings > About. */}
      {!searchResult.active && (
        <ContentContributionsSection contributions={contributions} />
      )}

      {searchResult.active ? (
        <ContentSearchResults
          searchResult={filteredSearchResult}
          downloadedSets={downloadedSets}
          openLessonFile={openLessonFile}
        />
      ) : (
        <ContentBrowsePanel
          hasDownloadedSets={downloadedSets.length > 0}
          visibleSets={visibleSets}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onResetFilters={filters.resetFilters}
          selection={selection}
          onBulkSetStatus={bulkStatus}
          onBulkDelete={() => setBulkDeleteTargets(selectedEntries)}
          onSetStatus={(e, status) => void handleSetStatus(e, status)}
          onDeleteSet={setDeleteSetTarget}
          treeProps={{
            tree,
            lang,
            collapsed,
            toggleNode,
            otherExpanded,
            setOtherExpanded,
            bookRecs,
            setRow: {
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
              onSetStatus: (e, status) => void handleSetStatus(e, status),
              onDelete: setDeleteSetTarget,
              selectable: true,
              selectedKeys: selection.selected,
              onToggleSelect: (e) => selection.toggle(setSelectionKey(e)),
            },
            folded: {
              setsByKey: userSetsByKey,
              communitySharingEnabled: COMMUNITY_SHARING_ENABLED,
              onPlayLesson: handlePlayFolded,
              onEdit: handleEditUserSet,
              onExportJson: (e) => void handleExportJson(e),
              onExportSet: (e) => void handleExportSet(e),
              onShare: (e) => void share.handleShare(e),
              onDelete: setDeleteTarget,
            },
          }}
        />
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

      {/* #1300 — destructive confirmation for removing a downloaded set. */}
      <DeleteSetModal
        target={deleteSetTarget}
        deleting={deletingSet}
        onCancel={() => setDeleteSetTarget(null)}
        onConfirm={() => void handleConfirmDeleteSet()}
      />

      {/* #1351 — destructive confirmation for removing several sets at once. */}
      <BulkDeleteSetsModal
        count={bulkDeleteCount}
        deleting={bulkDeleting}
        onCancel={() => setBulkDeleteTargets(null)}
        onConfirm={() =>
          void handleConfirmBulkDelete().then(() => selection.clear())
        }
      />
    </PageContainer>
  );
}
