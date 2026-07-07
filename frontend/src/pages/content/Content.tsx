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

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import InfoHintButton from "../../shared/feedback/InfoHintButton";
import PageContainer from "../../shared/layout/PageContainer";
import { useInfoHint } from "../../shared/feedback/useInfoHint";
import ContentTree from "../../components/content/browser/ContentTree";
import ContentShareDialog from "../../components/content/share/ContentShareDialog";
import ContentBookCompanions from "../../components/content/media/ContentBookCompanions";
import ContentContributionsSection from "../../components/content/contributions/ContentContributionsSection";
import ContentSearchBar from "../../components/content/browser/ContentSearchBar";
import FilterMenuButton from "../../shared/forms/FilterMenuButton";
import ContentSearchResults from "../../components/content/browser/ContentSearchResults";
import ContentViewToggle from "../../components/content/browser/ContentViewToggle";
import ContentSetListView, {
  setSelectionKey,
} from "../../components/content/browser/ContentSetListView";
import DeleteSetModal from "../../components/content/browser/DeleteSetModal";
import BulkActionBar from "../../components/content/browser/BulkActionBar";
import BulkDeleteSetsModal from "../../components/content/browser/BulkDeleteSetsModal";
import DeleteLessonModal from "../../components/content/lessons/DeleteLessonModal";
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
import { isOfficialSource } from "../../lib/content/repos/content-repos";
import {
  STATUS_FILTER_ORDER,
  matchesStatusFilter,
  type StatusFilter,
} from "../../lib/content/browse/set-status-filter";
import type { ContentSetEntry, SetStatus } from "../../storage/types";
import { Checkbox } from "@/components/ui/checkbox";

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
  // EXP-023 Phase B — source filter: "all" / "official" / a specific
  // user-repo source ("owner/repo").
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  // #1300 — lifecycle status filter. Default "active" so "Meine Inhalte"
  // opens on the clean working list; deferred/completed/all reachable here.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
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

  if (loading) {
    return (
      <PageContainer testId="content-loading">
        <p>{t("content.loading", "Loading content sets…")}</p>
      </PageContainer>
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
  const visibleSets = downloadedSets.filter((s) => {
    // #1300 — status filter (default "active"); "all" passes every status.
    if (!matchesStatusFilter(s, statusFilter)) return false;
    if (sourceFilter === "all") return true;
    if (sourceFilter === "official") return isOfficialSource(s.source);
    return s.source === sourceFilter;
  });

  // #1386 — the status + source filters render as two menu buttons (the
  // SetActionsMenu pattern; never a native select). Options are derived
  // dynamically; the source button is ALWAYS visible so the learner can
  // see what the list is (not) filtered to.
  const statusOptions = STATUS_FILTER_ORDER.map((value) => ({
    value,
    label:
      value === "all"
        ? t("content.set_status.all", "All")
        : value === "active"
          ? t("content.set_status.active", "Active")
          : value === "deferred"
            ? t("content.set_status.deferred", "Deferred")
            : t("content.set_status.completed", "Completed"),
  }));
  const hasOfficialSets = downloadedSets.some((s) => isOfficialSource(s.source));
  const sourceOptions = [
    { value: "all", label: t("content.filter.all_sources", "All sources") },
    ...(hasOfficialSets
      ? [{ value: "official", label: t("content.filter.official", "Official") }]
      : []),
    ...userRepoSources.map((src) => ({ value: src, label: src })),
  ];
  const passesSourceFilter = (entry: ContentSetEntry) =>
    sourceFilter === "all"
      ? true
      : sourceFilter === "official"
        ? isOfficialSource(entry.source)
        : entry.source === sourceFilter;

  // #1386 — search combines with the filters as AND (never filter silently:
  // the filter row stays visible while searching). Matches whose set fails
  // the active status/source filters are dropped from the result list.
  const filterPassKeys = new Set(
    sets
      .filter((s) => matchesStatusFilter(s, statusFilter) && passesSourceFilter(s))
      .map((s) => `${s.source}#${s.id}`),
  );
  const filteredMatches = searchResult.matches.filter((m) =>
    filterPassKeys.has(`${m.source}#${m.setId}`),
  );
  const filteredSearchResult = {
    ...searchResult,
    matches: filteredMatches,
    lessonCount: filteredMatches.reduce(
      (n, m) => n + m.matchedLessons.length,
      0,
    ),
  };

  // #1351 — multi-select derives from the currently VISIBLE (filtered) sets:
  // "select all" only ever covers what the learner can see, never silently
  // more. The selected entries drive the bulk actions.
  const visibleKeys = visibleSets.map(setSelectionKey);
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
      <header className="content-header" data-testid="content-header">
        <h1>{t("content.page_title", "Meine Inhalte")}</h1>
        {/* #1272 — the info button sits inline, right after the title;
            it reveals the intro prose + the (dynamic) sources line below
            the header on demand. */}
        <InfoHintButton
          expanded={headerInfo.expanded}
          blink={headerInfo.blink}
          label={t("ui.info.show", "Show information")}
          controls="content-info-text"
          onClick={headerInfo.toggle}
          testId="content-info-button"
          className="self-center"
        />
        <button
          type="button"
          className="content-refresh-btn ml-auto"
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
      {/* #1251 / #1272 — the permanent intro prose AND the sources line are
          replaced by the header info button above, which expands both here
          on demand (saving vertical space). The sources stay dynamic — the
          actually-configured sources from listSets(). */}
      {headerInfo.expanded && (
        <div
          id="content-info-text"
          data-testid="content-info-text"
          className="mb-4 text-sm text-muted-foreground"
        >
          <p>
            {t(
              "content.intro",
              "Pre-built lesson sets you can use without an API key. Downloads are cached locally and work offline after the first fetch.",
            )}
          </p>
          {sources.length > 0 && (
            <p className="content-sources mt-1" data-testid="content-sources">
              {t("content.sources", "Sources")}:{" "}
              {sources.map((src) => `${src.source} @ ${src.branch}`).join(", ")}
            </p>
          )}
        </div>
      )}

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
            options={statusOptions}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            testId="content-status-filter"
          />
          <FilterMenuButton
            label={t("content.filter_menu.source", "Source")}
            options={sourceOptions}
            value={sourceFilter}
            onChange={setSourceFilter}
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

      {/* Phase 64D — My Contributions (local sharing history). */}
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
        <>
          {/* #1149 — the "Missing Lessons" gap-suggestion block moved out
              of "Meine Inhalte" (consumption) into the dedicated
              /contribute area (production). */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="content-section-title">
              {t("content.my_lessons.downloaded_title", "Downloaded sets")}
            </h2>
            {downloadedSets.length > 0 && (
              <ContentViewToggle mode={viewMode} onChange={setViewMode} />
            )}
          </div>
          {downloadedSets.length === 0 ? (
            <p className="content-empty" data-testid="content-empty">
              {t(
                "content.empty",
                "No content sets available yet. Check your network connection and refresh, or configure a source in Settings.",
              )}
            </p>
          ) : visibleSets.length === 0 ? (
            /* #1386 — the active filters match nothing: say so and offer a
               one-tap reset instead of a dead-end blank list. */
            <div className="content-empty" data-testid="content-filter-empty">
              <p>
                {t(
                  "content.filter_empty",
                  "No sets match the active filters.",
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-2 min-h-11"
                onClick={() => {
                  setStatusFilter("all");
                  setSourceFilter("all");
                }}
                data-testid="content-filter-reset"
              >
                {t("content.filter_reset", "Reset filters")}
              </Button>
            </div>
          ) : (
            <>
              {/* #1351 — multi-select: select-all over the VISIBLE (filtered)
                  sets + the bulk-action bar (shown once ≥1 is selected). */}
              {visibleSets.length > 0 && (
                <div
                  className="mb-2 flex items-center gap-2"
                  data-testid="content-select-all-row"
                >
                  <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                    <span className="sr-only">
                      {t("content.set_status.select_all", "Select all")}
                    </span>
                    <Checkbox
                      checked={selection.masterState(visibleKeys)}
                      onCheckedChange={() => selection.selectAll(visibleKeys)}
                      aria-label={t("content.set_status.select_all", "Select all")}
                      data-testid="content-select-all"
                    />
                  </label>
                  <span className="text-sm text-muted-foreground">
                    {t("content.set_status.select_all", "Select all")}
                  </span>
                </div>
              )}
              <BulkActionBar
                count={selection.count}
                onSetStatus={bulkStatus}
                onDelete={() => setBulkDeleteTargets(selectedEntries)}
                onClear={selection.clear}
              />
              {viewMode === "list" ? (
            <ContentSetListView
              sets={visibleSets}
              onSetStatus={(e, status) => void handleSetStatus(e, status)}
              onDelete={setDeleteSetTarget}
              selectable
              selectedKeys={selection.selected}
              onToggleSelect={(e) => selection.toggle(setSelectionKey(e))}
            />
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
                onSetStatus: (e, status) => void handleSetStatus(e, status),
                onDelete: setDeleteSetTarget,
                selectable: true,
                selectedKeys: selection.selected,
                onToggleSelect: (e) => selection.toggle(setSelectionKey(e)),
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
