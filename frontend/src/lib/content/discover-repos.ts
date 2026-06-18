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
 * This is the impure glue (storage + network) the pure DIS-05 filter/sort layer
 * is deliberately kept free of.
 */

import { OFFICIAL_SOURCE, readUserRepos } from "./content-repos";
import { fetchRecommendedRepos, recommendedSource } from "./recommended-repos";
import { resolveRepoToken } from "./repo-token";
import type { SearchIndexRepo } from "./search-index-loader";

/**
 * Build the de-duplicated {@link SearchIndexRepo}[] for discovery. Never
 * throws — a failed recommended-repos fetch or user-repo read degrades to
 * whatever resolved (at minimum the official repo).
 */
export async function collectDiscoveryRepos(): Promise<SearchIndexRepo[]> {
  const repos: SearchIndexRepo[] = [
    { url: OFFICIAL_SOURCE, branch: "main", name: OFFICIAL_SOURCE },
  ];
  const seen = new Set<string>([OFFICIAL_SOURCE]);

  const recommended = await fetchRecommendedRepos().catch(() => []);
  for (const rec of recommended) {
    const source = recommendedSource(rec);
    if (!source || seen.has(source)) continue;
    seen.add(source);
    repos.push({
      url: rec.url,
      branch: rec.branch || "main",
      name: rec.title || source,
      token: resolveRepoToken(source),
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
    });
  }

  return repos;
}
