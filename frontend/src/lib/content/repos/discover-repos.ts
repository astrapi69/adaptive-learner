/**
 * Assemble the list of content repos whose search indices the discovery page
 * should load (EXP-034 / DIS-05).
 *
 * Sources, in order: the official content repo, every curated recommended repo
 * (from ``recommended-repos.json``), and every connected user repo. Duplicates
 * (by ``owner/repo``) collapse — the first occurrence wins, so the official +
 * recommended entries keep their curated display titles. Per-repo read tokens
 * are resolved for private / coach repos.
 *
 * A connected user repo is the only class flagged
 * ``allowManifestFallback: true`` (#2562): it already has no governance gate
 * (unlike the recommended registry's validated-snapshot requirement), so it
 * may also fall back to a live ``manifest.yaml`` read in
 * ``search-index-loader.ts`` when it has no ``search-index.json`` — without
 * that, a repo the user connects stays invisible in Discover until its owner
 * separately runs the engine's index generator.
 *
 * This is the impure glue (storage + network) the pure DIS-05 filter/sort layer
 * is deliberately kept free of.
 */

import { OFFICIAL_SOURCE, readUserRepos } from "./content-repos";
import {
  fetchRecommendedRepos,
  isValidatedForSearch,
  recommendedRef,
  recommendedSource,
} from "./recommended-repos";
import { resolveRepoToken } from "./repo-token";
import type { SearchIndexRepo } from "./search-index-loader";

/**
 * Build the de-duplicated {@link SearchIndexRepo}[] for discovery. Never
 * throws — a failed recommended-repos fetch or user-repo read degrades to
 * whatever resolved (at minimum the official repo).
 *
 * Registry (``recommended-repos.json``) entries are honoured per the
 * federated-search contract: only a repo whose snapshot is validated
 * ({@link isValidatedForSearch}) is searched, and every EXTERNAL repo is read
 * at its pinned ``commit`` — never the moving branch HEAD (the official
 * ``self`` entry stays branch-tracked). The registry ``trust_level`` seeds the
 * repo's ranking floor.
 */
export async function collectDiscoveryRepos(): Promise<SearchIndexRepo[]> {
  const repos: SearchIndexRepo[] = [
    { url: OFFICIAL_SOURCE, branch: "main", name: OFFICIAL_SOURCE, trustLevel: 3 },
  ];
  const seen = new Set<string>([OFFICIAL_SOURCE]);

  const recommended = await fetchRecommendedRepos().catch(() => []);
  for (const rec of recommended) {
    // Only a validated snapshot is federated; a pending/rejected/pre-governance
    // entry is skipped (it may still be listed as "recommended to add").
    if (!isValidatedForSearch(rec)) continue;
    const source = recommendedSource(rec);
    if (!source || seen.has(source)) continue;
    // An external (non-self) entry MUST pin a commit — the search never serves
    // an unpinned external snapshot.
    if (!rec.self && !rec.commit) continue;
    seen.add(source);
    repos.push({
      url: rec.url,
      branch: rec.branch || "main",
      ref: recommendedRef(rec),
      name: rec.title || source,
      token: resolveRepoToken(source),
      trustLevel: rec.trust_level,
    });
  }

  const userRepos = await readUserRepos().catch(() => []);
  for (const repo of userRepos) {
    const source = `${repo.owner}/${repo.repo}`;
    if (seen.has(source)) continue;
    seen.add(source);
    repos.push({
      url: source,
      branch: repo.branch || "main",
      name: source,
      token: resolveRepoToken(source),
      // #2562 — a connected user repo has no governance/validation gate to
      // begin with (unlike the recommended-repos registry below), so it is
      // also the one class allowed to fall back to a live manifest.yaml read
      // when it never published a search-index.json.
      allowManifestFallback: true,
    });
  }

  return repos;
}
