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

/**
 * Whether the curated catalogue is published yet. The file does NOT exist in
 * the content repo on purpose — it ships later with AUTH-03 (EXP-025). Until
 * then we must NOT request it: a `fetch` to the missing file makes the browser
 * log a 404 to the console on every Content/Settings visit (the browser logs
 * failed network requests itself, regardless of how the JS handles the
 * response — our code already returns `[]` silently). Skipping the request is
 * the only way to keep the console quiet. Flip to `true` in the same change
 * that publishes `recommended-repos.json`.
 */
const CATALOGUE_PUBLISHED = false;

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
 * Parse the catalogue payload into validated entries. Pure + never throws:
 * a non-array / malformed ``repos`` field resolves to ``[]``, and each entry
 * is required to carry a string ``url`` (branch defaults to ``main``).
 */
export function parseRecommendedRepos(data: unknown): RecommendedRepo[] {
  const repos = (data as { repos?: unknown } | null | undefined)?.repos;
  if (!Array.isArray(repos)) return [];
  return repos
    .filter(
      (r): r is RecommendedRepo =>
        !!r && typeof r === "object" && typeof (r as RecommendedRepo).url === "string",
    )
    .map((r) => ({ ...r, branch: r.branch || "main" }));
}

/**
 * Fetch the curated recommended-repos list. Never throws — a missing or
 * malformed catalogue resolves to ``[]``.
 *
 * While {@link CATALOGUE_PUBLISHED} is false the request is skipped entirely
 * (returns ``[]`` without touching the network), so the not-yet-published
 * file does not produce a console 404 on every Content/Settings load.
 */
export async function fetchRecommendedRepos(): Promise<RecommendedRepo[]> {
  if (!CATALOGUE_PUBLISHED) return [];
  try {
    const response = await fetch(RECOMMENDED_URL);
    if (!response.ok) return [];
    return parseRecommendedRepos(await response.json());
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
