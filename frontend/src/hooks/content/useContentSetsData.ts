/**
 * Data-loading state for the /content page (extracted from Content.tsx,
 * #896).
 *
 * Owns the set list plus every auxiliary data source the page composes
 * around it (book recommendations, supplementary media, book companions,
 * per-source trust/recommended metadata, per-set download state, the
 * loaded lessons of user-generated sets, the local contribution history,
 * and the per-set AI-checked badge status) and the effects that fetch
 * them. Pure data plumbing: no JSX. The page consumes the returned
 * view-model and derives the render-time values from it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { DownloadState } from "../../components/content/browser/ContentSetRow";
import {
  type BookRecommendations,
  fetchBookRecommendations,
} from "../../lib/content/media/book-recommendations";
import {
  type BookMetadata,
  fetchBookCompanion,
  isFetchableSource,
} from "../../lib/content/media/book-companion";
import {
  type MediaResource,
  fetchMediaResources,
} from "../../lib/content/media/media-loader";
import { type UserFoldInput } from "../../lib/content/browse/content-tree";
import {
  listContributions,
  type SharedContribution,
} from "../../lib/content/placement/contribution-history";
import { readUserRepos, userRepoSource } from "../../lib/content/repos/content-repos";
import { isDismissedSet } from "../../lib/content/repos/dismissed-sets";
import { isHiddenSet } from "../../lib/content/repos/hidden-sets";
import {
  fetchRecommendedRepos,
  recommendedSource,
} from "../../lib/content/repos/recommended-repos";
import { badgeStatusForCachedSet } from "../../lib/ai/validation/validation-signature";
import type { AiCheckBadgeStatus } from "../../shared/status/AiCheckedBadge";
import { getStorage } from "../../storage";
import { USER_GENERATED_SOURCE } from "../../storage/types";
import type { ContentSetEntry, ContentSetSource } from "../../storage/types";
import { useI18n } from "../ui/useI18n";
import { notify } from "../../utils/notify";

/** Per-source trust/coach metadata for the source badges (EXP-023 B). */
export type RepoMetaMap = Record<string, { trust: number; coach: boolean }>;

/**
 * View-model returned to the /content page. Setters are exposed where the
 * page mutates the data in place (download status, optimistic set-list
 * edits after delete/download, contribution refresh after a share).
 */
export interface ContentSetsData {
  sets: ContentSetEntry[];
  setSets: React.Dispatch<React.SetStateAction<ContentSetEntry[]>>;
  sources: ContentSetSource[];
  loading: boolean;
  refreshing: boolean;
  loadSets: () => Promise<void>;
  handleRefresh: () => void;
  bookRecs: BookRecommendations;
  media: MediaResource[];
  bookCompanions: Record<string, BookMetadata>;
  perSetState: Record<string, DownloadState>;
  setPerSetState: React.Dispatch<
    React.SetStateAction<Record<string, DownloadState>>
  >;
  userLessonsBySet: Record<string, UserFoldInput["lessons"]>;
  repoMeta: RepoMetaMap;
  recommendedSources: Set<string>;
  contributions: SharedContribution[];
  setContributions: React.Dispatch<React.SetStateAction<SharedContribution[]>>;
  aiBadgeBySet: Record<string, AiCheckBadgeStatus>;
}

/** Loads the set list and all the data the page composes around it. */
export function useContentSetsData(): ContentSetsData {
  const { t } = useI18n();
  const [sets, setSets] = useState<ContentSetEntry[]>([]);
  const [sources, setSources] = useState<ContentSetSource[]>([]);
  // #141 — per-domain book recommendations, fetched once from the
  // official content repo (graceful empty on failure / offline).
  const [bookRecs, setBookRecs] = useState<BookRecommendations>({});
  // EXP-029 / MED-06 — per-domain supplementary media (media.yaml),
  // fetched once from the official content repo (graceful empty on
  // failure / offline). Drives the set-row media-availability badges.
  const [media, setMedia] = useState<MediaResource[]>([]);
  // EXP-025 / AUTH-02 — book a connected repo accompanies, keyed by source.
  const [bookCompanions, setBookCompanions] = useState<
    Record<string, BookMetadata>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [perSetState, setPerSetState] = useState<Record<string, DownloadState>>(
    {},
  );
  // EXP-026 / UGC-04 — the loaded lessons of each user-generated set,
  // keyed ``${source}#${id}``, used to fold them into the tree.
  const [userLessonsBySet, setUserLessonsBySet] = useState<
    Record<string, UserFoldInput["lessons"]>
  >({});
  // EXP-023 Phase B — per-repo trust/coach lookup for source badges.
  const [repoMeta, setRepoMeta] = useState<RepoMetaMap>({});
  const [recommendedSources, setRecommendedSources] = useState<Set<string>>(
    new Set(),
  );
  // Phase 64D — local contribution history (localStorage; no server).
  const [contributions, setContributions] = useState<SharedContribution[]>([]);
  // AIV-11 — per-set "AI-checked" badge status, keyed "{source}#{id}".
  const [aiBadgeBySet, setAiBadgeBySet] = useState<
    Record<string, AiCheckBadgeStatus>
  >({});

  useEffect(() => {
    let cancelled = false;
    void readUserRepos().then((repos) => {
      if (cancelled) return;
      const map: RepoMetaMap = {};
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
    void fetchMediaResources().then((list) => {
      if (!cancelled) setMedia(list);
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

  useEffect(() => {
    setContributions(listContributions());
  }, []);

  // AIV-11 — load the cached AI-validation signatures for downloaded sets
  // and derive the badge status (cheap: version-based, no hash recompute).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const storage = getStorage();
      const downloaded = sets.filter(
        (s) => s.source !== USER_GENERATED_SOURCE && s.cached_version !== null,
      );
      const map: Record<string, AiCheckBadgeStatus> = {};
      for (const entry of downloaded) {
        try {
          const cache = await storage.contentLoader.getAiValidationCache(
            entry.source,
            entry.id,
          );
          const status = badgeStatusForCachedSet(
            cache?.signature ?? null,
            cache?.set_version ?? null,
            entry.cached_version,
          );
          if (status !== "none") map[`${entry.source}#${entry.id}`] = status;
        } catch {
          /* a cache read failure just means no badge for that set */
        }
      }
      if (!cancelled) setAiBadgeBySet(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [sets]);

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
          const listing = await getStorage().contentLoader.listLessons(
            set.source,
            set.id,
          );
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

  // Guards every async setState below against a resolve that lands AFTER
  // the component unmounts (or, in the test env, after the happy-dom
  // window is torn down) — React's ``dispatchSetState`` touches ``window``
  // and throws "window is not defined", which Vitest surfaces as a fatal
  // unhandled rejection. The other effects in this hook already use a
  // per-effect ``cancelled`` flag; ``loadSets`` is shared by the mount
  // effect + ``handleRefresh``, so it uses this mounted ref instead.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSets = useCallback(async () => {
    try {
      const data = await getStorage().contentLoader.listSets();
      if (!mountedRef.current) return;
      // #1702 — filter hidden reference/conformance fixtures out of "Meine
      // Inhalte", covering a set that may already have been downloaded/imported.
      // #1709 — sets the user explicitly deleted (dismissed-sets) are dropped
      // too while they are NOT cached: the source catalogue keeps advertising
      // them, so without this a bare Refresh restored every deleted set. A
      // cached entry always wins over its dismissal record (re-downloading
      // revives the set), and /discover intentionally keeps listing them.
      // Preserve the original array reference when nothing is dropped (the
      // common case): the downstream ``[sets]``-keyed effects rely on ``sets``
      // being referentially stable between renders, so allocate a new array
      // only when an entry is actually removed.
      const dropped = (s: ContentSetEntry) =>
        isHiddenSet(s.source, s.id) ||
        (s.cached_version === null && isDismissedSet(s.source, s.id));
      const visible = data.sets.some(dropped)
        ? data.sets.filter((s) => !dropped(s))
        : data.sets;
      setSets(visible);
      setSources(data.sources);
    } catch (err) {
      if (!mountedRef.current) return;
      notify.error(t("content.error.list_failed", "Could not load content sets."), {
        apiError: err instanceof Error ? undefined : undefined,
      });
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [t]);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadSets();
  };

  return {
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
  };
}
