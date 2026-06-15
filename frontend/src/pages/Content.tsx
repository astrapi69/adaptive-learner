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
 * This page is the layout shell: it loads the sets, owns the search +
 * toolbar + Continue Learning + contributions + search results, and
 * composes the extracted sections — {@link MyLessonsSection},
 * {@link ContentTree}, and {@link ContentShareDialog} (backed by
 * {@link useContentSharing}).
 */

import {
  Map as MapIcon,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ContinueLearning from "../components/ContinueLearning";
import ImportLessonModal from "../components/content/ImportLessonModal";
import MyLessonsSection from "../components/content/MyLessonsSection";
import ContentTree from "../components/content/ContentTree";
import ContentShareDialog from "../components/content/ContentShareDialog";
import type { DownloadState } from "../components/content/ContentSetRow";
import {
  type BookRecommendations,
  fetchBookRecommendations,
} from "../lib/content/book-recommendations";
import {
  type BookMetadata,
  fetchBookCompanion,
  isFetchableSource,
} from "../lib/content/book-companion";
import ContentBookCompanions from "../components/content/ContentBookCompanions";
import ContentContributionsSection from "../components/content/ContentContributionsSection";
import { splitHighlight } from "../lib/content/content-search";
import { useContentSearch } from "../hooks/useContentSearch";
import { useContentSharing } from "../hooks/useContentSharing";
import { useI18n } from "../hooks/useI18n";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useSourceLanguages } from "../hooks/useSourceLanguages";
import {
  buildContentTree,
  type FoldedUserLesson,
  type UserFoldInput,
} from "../lib/content/content-tree";
import { computeUserFold } from "../lib/content/user-fold";
import { languageDisplayName } from "../lib/content/language-names";
import {
  listContributions,
  recordContribution,
  type SharedContribution,
} from "../lib/content/contribution-history";
import { detectGaps } from "../lib/content/gap-detector";
import { useApiKeyStatus } from "../hooks/useApiKeyStatus";
import { readLearnerState } from "../lib/learnerState";
import {
  buildContentSetZip,
  contentSetFileName,
  downloadLessonJson,
  triggerDownload,
  type ExportSetMeta,
} from "../lib/content/lesson-export";
import { getStorage } from "../storage";
import { USER_GENERATED_SOURCE } from "../storage/types";
import { isOfficialSource, readUserRepos, userRepoSource } from "../lib/content/content-repos";
import { fetchRecommendedRepos, recommendedSource } from "../lib/content/recommended-repos";
import type { ContentLesson, ContentSetEntry, ContentSetSource } from "../storage/types";
import { notify } from "../utils/notify";

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
  const [sets, setSets] = useState<ContentSetEntry[]>([]);
  const [sources, setSources] = useState<ContentSetSource[]>([]);
  // #141 — per-domain book recommendations, fetched once from the
  // official content repo (graceful empty on failure / offline).
  const [bookRecs, setBookRecs] = useState<BookRecommendations>({});
  // EXP-025 / AUTH-02 — book a connected repo accompanies, keyed by source.
  const [bookCompanions, setBookCompanions] = useState<Record<string, BookMetadata>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [perSetState, setPerSetState] = useState<Record<string, DownloadState>>({});
  // EXP-026 / UGC-04 — the loaded lessons of each user-generated set,
  // keyed ``${source}#${id}``, used to fold them into the tree.
  const [userLessonsBySet, setUserLessonsBySet] = useState<
    Record<string, UserFoldInput["lessons"]>
  >({});
  // Phase 59C — My Lessons delete-confirm modal target.
  const [deleteTarget, setDeleteTarget] = useState<ContentSetEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
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
  // EXP-023 Phase A — source filter over the content tree.
  // EXP-023 Phase B — per-repo trust/coach lookup for source badges.
  const [repoMeta, setRepoMeta] = useState<Record<string, { trust: number; coach: boolean }>>({});
  const [recommendedSources, setRecommendedSources] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    void readUserRepos().then((repos) => {
      if (cancelled) return;
      const map: Record<string, { trust: number; coach: boolean }> = {};
      for (const r of repos) {
        map[userRepoSource(r.owner, r.repo)] = {
          trust: r.trust ?? 0,
          coach: Boolean(r.coach),
        };
      }
      setRepoMeta(map);
    });
    void fetchRecommendedRepos().then((list) => {
      if (cancelled) return;
      const set = new Set<string>();
      for (const rec of list) {
        const s = recommendedSource(rec);
        if (s) set.add(s);
      }
      setRecommendedSources(set);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // #141 — load per-domain book recommendations once on mount.
  useEffect(() => {
    let cancelled = false;
    void fetchBookRecommendations().then((recs) => {
      if (!cancelled) setBookRecs(recs);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // EXP-025 / AUTH-02 — load the book a connected repo accompanies, if
  // any. Keyed off the configured sources; bundled sources are skipped.
  const sourcesSig = sources.map((s) => `${s.source}@${s.branch}`).join(",");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const bySource: Record<string, BookMetadata> = {};
      for (const src of sources) {
        if (!isFetchableSource(src.source)) continue;
        const book = await fetchBookCompanion(src.source, src.branch);
        if (book) bySource[src.source] = book;
      }
      if (!cancelled) setBookCompanions(bySource);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesSig]);
  // EXP-023 Phase B — source filter: "all" / "official" / a specific
  // user-repo source ("owner/repo").
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  // Phase 64D — local contribution history (localStorage; no server).
  const [contributions, setContributions] = useState<SharedContribution[]>([]);
  useEffect(() => {
    setContributions(listContributions());
  }, []);
  const { hasKey, activeProvider } = useApiKeyStatus();
  const userId = readLearnerState().userId;

  // --- Content Browser search (#354 — extracted to useContentSearch) ---
  const {
    searchQuery,
    setSearchQuery,
    activateSearch,
    searchInputRef,
    searchResult,
  } = useContentSearch(sets);

  /** Highlight raw query occurrences inside a label. */
  const highlightNodes = (text: string, query: string) =>
    splitHighlight(text, query).map((seg, i) =>
      seg.match ? (
        <mark key={i} className="bg-transparent font-semibold text-accent">
          {seg.text}
        </mark>
      ) : (
        <span key={i}>{seg.text}</span>
      ),
    );

  const loadSets = useCallback(async () => {
    try {
      const data = await getStorage().contentLoader.listSets();
      setSets(data.sets);
      setSources(data.sources);
    } catch (err) {
      notify.error(t("content.error.list_failed", "Could not load content sets."), {
        apiError: err instanceof Error ? undefined : undefined,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadSets();
  };

  const setKey = (entry: ContentSetEntry): string => `${entry.source}#${entry.id}`;

  /** Navigate to a specific lesson file (used by search results). */
  const openLessonFile = (source: string, id: string, filename: string) => {
    const slug = source.replace(/\//g, "--");
    navigate(
      `/lesson/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`,
    );
  };

  const handleOpenLesson = async (entry: ContentSetEntry) => {
    // Phase 44 / EXP-002 / 3B: jump to the set's first
    // cached lesson. Future enhancements can swap this for
    // a dedicated per-set lesson list page.
    try {
      const listing = await getStorage().contentLoader.listLessons(entry.source, entry.id);
      const first = listing.lessons[0];
      if (!first) {
        notify.warning(t("content.warning.no_lessons_in_set", "This set has no lessons yet."));
        return;
      }
      const slug = entry.source.replace(/\//g, "--");
      navigate(
        `/lesson/${encodeURIComponent(slug)}/${encodeURIComponent(entry.id)}/${encodeURIComponent(first)}`,
      );
    } catch (err) {
      notify.error(t("content.error.open_failed", "Could not open the lesson."), {
        apiError: err instanceof Error ? undefined : undefined,
      });
    }
  };

  // Phase 59C — edit a user-generated lesson: jump back to its
  // source conversation's import page, where re-saving overwrites
  // the set in place. Only analysis-sourced sets carry a
  // recoverable conversation id (set id is ``analysis-{convId}``).
  const handleEditUserSet = (entry: ContentSetEntry) => {
    const convId = entry.id.replace(/^analysis-/, "");
    navigate(`/import/${encodeURIComponent(convId)}`);
  };

  const handleDeleteUserSet = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await getStorage().contentLoader.deleteSet(deleteTarget.source, deleteTarget.id);
      setSets((prev) =>
        prev.filter((row) => !(row.source === deleteTarget.source && row.id === deleteTarget.id)),
      );
      notify.success(t("content.my_lessons.deleted", "Lesson deleted."));
      setDeleteTarget(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.my_lessons.delete_failed", "Could not delete the lesson.")} ${detail}`,
      );
    } finally {
      setDeleting(false);
    }
  };

  // Phase 59D — export + community sharing.
  const exportMeta = (entry: ContentSetEntry): ExportSetMeta => ({
    set_id: entry.id,
    title: entry.title,
    language: entry.language,
    level: entry.level,
    description: entry.description,
  });

  const fetchSetLessons = async (entry: ContentSetEntry): Promise<ContentLesson[]> => {
    const listing = await getStorage().contentLoader.listLessons(entry.source, entry.id);
    return Promise.all(
      listing.lessons.map((f) => getStorage().contentLoader.getLesson(entry.source, entry.id, f)),
    );
  };

  const handleExportJson = async (entry: ContentSetEntry) => {
    try {
      const lessons = await fetchSetLessons(entry);
      if (lessons.length === 1) {
        downloadLessonJson(lessons[0]);
      } else {
        const blob = await buildContentSetZip(exportMeta(entry), lessons);
        triggerDownload(blob, contentSetFileName(entry.title));
      }
      notify.success(t("content.my_lessons.exported", "Lesson exported."));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(`${t("content.error.open_failed", "Could not open the lesson.")} ${detail}`);
    }
  };

  const handleExportSet = async (entry: ContentSetEntry) => {
    try {
      const lessons = await fetchSetLessons(entry);
      const blob = await buildContentSetZip(exportMeta(entry), lessons);
      triggerDownload(blob, contentSetFileName(entry.title));
      notify.success(t("content.my_lessons.exported", "Lesson exported."));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(`${t("content.error.open_failed", "Could not open the lesson.")} ${detail}`);
    }
  };

  // EXP-026 / UGC-04 — load each user-generated set's lessons so they
  // can be folded into the matching published tree node. Keyed off
  // ``sets`` (state, stable between renders) so it doesn't loop.
  useEffect(() => {
    let cancelled = false;
    const userGen = sets.filter((s) => s.source === USER_GENERATED_SOURCE);
    if (userGen.length === 0) {
      setUserLessonsBySet({});
      return;
    }
    void (async () => {
      const byKey: Record<string, UserFoldInput["lessons"]> = {};
      for (const set of userGen) {
        try {
          const listing = await getStorage().contentLoader.listLessons(set.source, set.id);
          const lessons = await Promise.all(
            listing.lessons.map(async (filename) => {
              const lesson = await getStorage().contentLoader.getLesson(
                set.source,
                set.id,
                filename,
              );
              return {
                id: lesson.id,
                filename,
                title: lesson.title,
                variation_of: lesson.variation_of,
              };
            }),
          );
          byKey[`${set.source}#${set.id}`] = lessons;
        } catch {
          /* a set that fails to load just stays in the My Lessons fallback */
        }
      }
      if (!cancelled) setUserLessonsBySet(byKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [sets]);

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

  const handleDownload = async (entry: ContentSetEntry) => {
    const key = setKey(entry);
    setPerSetState((prev) => ({ ...prev, [key]: "downloading" }));
    try {
      const updated = await getStorage().contentLoader.downloadSet(entry.source, entry.id);
      setSets((prev) =>
        prev.map((row) => (row.source === entry.source && row.id === entry.id ? updated : row)),
      );
      setPerSetState((prev) => ({ ...prev, [key]: "done" }));
      notify.success(t("content.toast.downloaded", "Set downloaded and ready to use."));
    } catch (err) {
      setPerSetState((prev) => ({ ...prev, [key]: "error" }));
      notify.error(t("content.error.download_failed", "Could not download the set."), {
        apiError: err instanceof Error ? undefined : undefined,
      });
    }
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
      <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="content-toolbar">
        <div
          className="relative flex min-w-[200px] flex-1 items-center"
          data-testid="content-search-bar"
        >
          {!searchQuery && (
            <Search
              size={18}
              className="pointer-events-none absolute right-3 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <Input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onFocus={activateSearch}
            onChange={(e) => {
              activateSearch();
              setSearchQuery(e.target.value);
            }}
            placeholder={t("content.search.placeholder", "Search lessons...")}
            aria-label={t("content.search.placeholder", "Search lessons...")}
            className="pl-3 pr-10"
            data-testid="content-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
              aria-label={t("content.search.clear", "Clear search")}
              data-testid="content-search-clear"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] gap-2"
            onClick={() => setShowImport(true)}
            title={t("content.import_lesson.button", "Import Lesson")}
            aria-label={t("content.import_lesson.button", "Import Lesson")}
            data-testid="content-import-lesson"
          >
            <Upload className="h-5 w-5" aria-hidden="true" />
            <span className="hidden md:inline">
              {t("content.import_lesson.button", "Import Lesson")}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] gap-2"
            onClick={() => navigate("/import")}
            title={t("content.import_chat.button", "Import Chat")}
            aria-label={t("content.import_chat.button", "Import Chat")}
            data-testid="content-import-chat"
          >
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
            <span className="hidden md:inline">
              {t("content.import_chat.button", "Import Chat")}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] gap-2"
            onClick={() => navigate("/learning-path")}
            title={t("nav.learning_path", "Learning Path")}
            aria-label={t("nav.learning_path", "Learning Path")}
            data-testid="content-learning-path"
          >
            <MapIcon className="h-5 w-5" aria-hidden="true" />
            <span className="hidden md:inline">{t("nav.learning_path", "Learning Path")}</span>
          </Button>
          <Button
            type="button"
            className="min-h-[44px] gap-2"
            onClick={() => navigate("/create-lesson")}
            title={t("content.create_lesson.button", "Create New Lesson")}
            aria-label={t("content.create_lesson.button", "Create New Lesson")}
            data-testid="content-create-lesson"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="hidden md:inline">
              {t("content.create_lesson.button", "Create New Lesson")}
            </span>
          </Button>
        </div>
      </div>

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
        <section className="content-search-results space-y-4" data-testid="content-search-results">
          {searchResult.matches.length === 0 ? (
            <div className="content-empty" data-testid="content-search-empty">
              <p>
                {t("content.search.no_results", "No results for '{query}'").replace(
                  "{query}",
                  searchResult.query.trim(),
                )}
              </p>
              <p className="muted">{t("content.search.hint", "Try a different search term")}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground" data-testid="content-search-count">
                {t("content.search.results", "{count} results").replace(
                  "{count}",
                  String(searchResult.lessonCount),
                )}
              </p>
              {searchResult.matches.map((match) => {
                const entry = downloadedSets.find(
                  (s) => s.source === match.source && s.id === match.setId,
                );
                if (!entry) return null;
                return (
                  <div
                    key={`${match.source}#${match.setId}`}
                    data-testid={`content-search-set-${match.setId}`}
                  >
                    <h3 className="font-semibold">
                      {highlightNodes(entry.title, searchResult.query)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        · {(entry.source_language || "").toUpperCase()}
                        {entry.target_language
                          ? ` → ${entry.target_language.toUpperCase()}`
                          : ""}{" "}
                        {entry.level}
                      </span>
                    </h3>
                    <ul className="mt-1 space-y-1 pl-4">
                      {match.matchedLessons.map((lessonRef) => (
                        <li key={lessonRef.filename}>
                          <button
                            type="button"
                            className="text-left text-accent hover:underline"
                            onClick={() =>
                              openLessonFile(match.source, match.setId, lessonRef.filename)
                            }
                            data-testid={`content-search-lesson-${match.setId}-${lessonRef.filename}`}
                          >
                            {highlightNodes(lessonRef.title, searchResult.query)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </>
          )}
        </section>
      ) : (
        <>
          {/* Phase 64E — encouraging gap suggestions ("Can you help?"). */}
          {(() => {
            const gaps = detectGaps(downloadedSets).slice(0, 5);
            if (gaps.length === 0) return null;
            return (
              <section className="content-section content-gaps" data-testid="content-gaps">
                <h2>{t("content.gaps.title", "Missing Lessons")}</h2>
                <p className="content-gaps-intro">
                  {t(
                    "content.gaps.intro",
                    "The community library has a few gaps. Can you help fill one?",
                  )}
                </p>
                <ul className="content-gaps-list" data-testid="content-gaps-list">
                  {gaps.map((gap, i) => (
                    <li
                      key={`${gap.kind}-${gap.source}-${gap.target}-${gap.level}-${i}`}
                      className="content-gap-row"
                    >
                      <span>
                        {(gap.kind === "next_level"
                          ? t(
                              "content.gaps.next_level",
                              "{target} for {source} speakers has lessons, but {level} doesn't exist yet.",
                            )
                          : t(
                              "content.gaps.missing_pair",
                              "{target} {level} for {source} speakers doesn't exist yet.",
                            )
                        )
                          .replace("{target}", languageDisplayName(gap.target, lang))
                          .replace("{source}", languageDisplayName(gap.source, lang))
                          .replace("{level}", gap.level)}
                      </span>{" "}
                      <a
                        href={`https://github.com/${COMMUNITY_REPO}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="content-gap-help"
                      >
                        {t("content.gaps.help", "Can you help?")}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })()}

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

      {deleteTarget && (
        <div className="modal-overlay" data-testid="my-lesson-delete-modal">
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-lesson-title"
          >
            <h2 id="delete-lesson-title" className="modal-title">
              {deleteTarget.title}
            </h2>
            <p>
              {t("content.my_lessons.delete_confirm", "Delete this lesson? This cannot be undone.")}
            </p>
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                data-testid="my-lesson-delete-cancel"
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteUserSet}
                disabled={deleting}
                data-testid="my-lesson-delete-confirm"
              >
                {deleting
                  ? t("common.loading", "Loading…")
                  : t("content.my_lessons.delete", "Delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
