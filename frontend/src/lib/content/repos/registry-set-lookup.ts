/**
 * Resolve a shared set id against the federated registry (#3819).
 *
 * A short set link (``/content/set/<id>``) names only the set. When the set is
 * not in the app's own listing, the repo that carries it may still be one the
 * learner has not added yet: a recommended repo from ``recommended-repos.json``.
 * This module looks the id up in those repos' search indices and names the
 * repo to connect.
 *
 * The official repo is skipped: its sets are always in the app's listing, so
 * a miss there is a genuine miss. The indices load in parallel; the first repo
 * in {@link collectDiscoveryRepos} order that carries the id wins.
 */

import { collectDiscoveryRepos } from "./discover-repos";
import { OFFICIAL_SOURCE } from "./source-identity";
import {
  fetchSearchIndex,
  type SearchableSet,
  type SearchIndexRepo,
} from "./search-index-loader";

/** The repo to connect so a found set becomes loadable. */
export interface RegistryRepoRef {
  /** ``owner/repo`` or the full GitHub URL, as the registry names it. */
  url: string;
  /** The branch to connect. The index may be pinned to a commit; a connected
   *  repo tracks its branch. */
  branch: string;
}

/** Outcome of {@link findSetInRegistry}. */
export type RegistrySetLookup =
  | { status: "found"; set: SearchableSet; repo: RegistryRepoRef }
  /** No registry repo carries the id. */
  | { status: "absent" }
  /** Nothing matched and the browser reports being offline, so a miss may
   *  only mean the indices could not be read. */
  | { status: "unreachable" };

/** Injection seams for {@link findSetInRegistry}; production uses the defaults. */
export interface RegistrySetLookupDeps {
  collectRepos: () => Promise<SearchIndexRepo[]>;
  fetchIndex: (repo: SearchIndexRepo) => Promise<SearchableSet[]>;
  isOnline: () => boolean;
}

const DEFAULT_DEPS: RegistrySetLookupDeps = {
  collectRepos: collectDiscoveryRepos,
  fetchIndex: (repo) => fetchSearchIndex(repo),
  isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
};

/**
 * Find the registry repo that carries ``setId``. Never throws.
 *
 * A cached index answers while offline (``fetchSearchIndex`` serves its
 * cache), so ``unreachable`` is reported only for a miss while offline.
 *
 * @example
 * const result = await findSetInRegistry("ki-einsteiger-from-de");
 * if (result.status === "found") connect(result.repo);
 */
export async function findSetInRegistry(
  setId: string,
  deps: RegistrySetLookupDeps = DEFAULT_DEPS,
): Promise<RegistrySetLookup> {
  if (!setId) return { status: "absent" };
  const repos = (await deps.collectRepos().catch(() => [] as SearchIndexRepo[])).filter(
    (repo) => repo.url !== OFFICIAL_SOURCE,
  );
  const indices = await Promise.all(
    repos.map((repo) => deps.fetchIndex(repo).catch(() => [] as SearchableSet[])),
  );
  for (const [i, sets] of indices.entries()) {
    const set = sets.find((candidate) => candidate.id === setId);
    if (set) {
      const repo = repos[i];
      return { status: "found", set, repo: { url: repo.url, branch: repo.branch || "main" } };
    }
  }
  return deps.isOnline() ? { status: "absent" } : { status: "unreachable" };
}
