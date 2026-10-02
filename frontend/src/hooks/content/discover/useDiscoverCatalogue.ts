/**
 * useDiscoverCatalogue (EXP-034 / DIS-05), split out of the Discover page
 * (#3271).
 *
 * Loads the lean search indices of every available content repo once on
 * mount: an instant paint from the TTL cache, then a forced live refresh so a
 * newly-published set appears without waiting out the 24h TTL (#1337). Tracks
 * which sets are already downloaded locally and which are new since the
 * learner last saw the catalogue (#1337 f/u).
 *
 * @example
 * const { allSets, downloadedKeys, setDownloadedKeys, newKeys, loading } =
 *   useDiscoverCatalogue();
 */

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { ApiError } from "../../../api/client";
import {
  markCatalogSeen,
  newKeysAgainstSeen,
} from "../../../lib/content/browse/prefs/seen-catalog";
import { discoverSetKey, isSetDownloaded } from "../../../lib/content/repos/discover-index";
import { collectDiscoveryRepos } from "../../../lib/content/repos/discover-repos";
import {
  fetchAllIndices,
  type SearchableSet,
} from "../../../lib/content/repos/search-index-loader";
import { getStorage } from "../../../storage";
import { notify } from "../../../utils/notify";
import { useI18n } from "../../ui/useI18n";

/** The loaded catalogue plus its per-set local state. */
interface DiscoverCatalogue {
  allSets: SearchableSet[];
  /** Keys of sets already present in the local content cache. */
  downloadedKeys: Set<string>;
  setDownloadedKeys: Dispatch<SetStateAction<Set<string>>>;
  /** Keys of sets newly added to the catalogue since the user last saw it. */
  newKeys: Set<string>;
  loading: boolean;
}

/** Load the Discover catalogue once on mount. */
export function useDiscoverCatalogue(): DiscoverCatalogue {
  const { t } = useI18n();
  const [allSets, setAllSets] = useState<SearchableSet[]>([]);
  const [downloadedKeys, setDownloadedKeys] = useState<Set<string>>(new Set());
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const repos = await collectDiscoveryRepos();
        const local = await getStorage()
          .contentLoader.listSets()
          .catch(() => ({ sets: [], sources: [] }));
        const applySets = (sets: SearchableSet[]) => {
          if (cancelled) return;
          setAllSets(sets);
          const keys = new Set<string>();
          for (const set of sets) {
            if (isSetDownloaded(set, local.sets)) keys.add(discoverSetKey(set));
          }
          setDownloadedKeys(keys);
        };
        // 1) Instant paint from the TTL cache (stale-while-revalidate).
        applySets(await fetchAllIndices(repos));
        if (cancelled) return;
        setLoading(false);
        // 2) Always force-refresh the catalogue from the live repo so a
        //    newly-published set (e.g. the first set in a new source
        //    language) appears on reopen without waiting out the 24h TTL,
        //    and after a content sync. A failed refresh keeps the cached
        //    list (#1337).
        const fresh = await fetchAllIndices(repos, { forceRefresh: true });
        applySets(fresh);
        if (cancelled) return;
        // New-content indicator: flag sets not in the last-seen anchor, then
        // update the anchor so they are no longer "New" next time (#1337 f/u).
        const freshKeys = fresh.map(discoverSetKey);
        setNewKeys(newKeysAgainstSeen(freshKeys));
        markCatalogSeen(freshKeys);
      } catch (err) {
        if (!cancelled) {
          notify.error(
            t("discover.error.load_failed", "Could not load available content."),
            { apiError: err instanceof ApiError ? err : undefined },
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // Run once on mount; t only affects the error label.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { allSets, downloadedKeys, setDownloadedKeys, newKeys, loading };
}
