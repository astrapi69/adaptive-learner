/**
 * Curated "recommended repositories" list (EXP-023 Phase C slice).
 *
 * A small, maintainer-curated catalogue of recommended content repos,
 * published as a static ``recommended-repos.json`` at the root of the
 * official content repository. Fetching it needs no server — it rides the
 * same GitHub-raw path as the content itself. Membership in this list is
 * what makes a repo "officially recommended" (Trust 3).
 *
 * Failure is non-fatal: a missing / malformed file resolves to ``[]`` so
 * the discovery UI simply shows nothing.
 */

import { parseGitHubRepoUrl, userRepoSource } from "./content-repos";

const OFFICIAL_OWNER_REPO = "astrapi69/adaptive-learner-content";
const RECOMMENDED_URL = `https://raw.githubusercontent.com/${OFFICIAL_OWNER_REPO}/main/recommended-repos.json`;

/** One entry in the curated recommended-repos catalogue. */
export interface RecommendedRepo {
  /** ``owner/repo`` or a full GitHub URL. */
  url: string;
  /** Branch to read from. Defaults to ``main``. */
  branch: string;
  /** Optional display title + description for the discovery card. */
  title?: string;
  description?: string;
}

/** The ``owner/repo`` source identifier for a recommended entry, or null. */
export function recommendedSource(rec: RecommendedRepo): string | null {
  const parsed = parseGitHubRepoUrl(rec.url);
  return parsed ? userRepoSource(parsed.owner, parsed.repo) : null;
}

/**
 * Fetch the curated recommended-repos list. Never throws — a missing or
 * malformed catalogue resolves to ``[]``.
 */
export async function fetchRecommendedRepos(): Promise<RecommendedRepo[]> {
  try {
    const response = await fetch(RECOMMENDED_URL);
    if (!response.ok) return [];
    const data = (await response.json()) as { repos?: unknown };
    const repos = data?.repos;
    if (!Array.isArray(repos)) return [];
    return repos
      .filter(
        (r): r is RecommendedRepo =>
          !!r && typeof r === "object" && typeof (r as RecommendedRepo).url === "string",
      )
      .map((r) => ({ ...r, branch: r.branch || "main" }));
  } catch {
    return [];
  }
}

/** True when ``source`` is one of the curated recommended repos. */
export function isRecommendedSource(
  source: string,
  list: RecommendedRepo[],
): boolean {
  return list.some((rec) => recommendedSource(rec) === source);
}
