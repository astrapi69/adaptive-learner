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
 * Whether the curated catalogue is published yet. `recommended-repos.json`
 * now exists at the content-repo root (#547), so the fetch is enabled: a
 * missing/malformed file still resolves to `[]` silently, but the happy path
 * surfaces the officially-recommended repos in the discovery UI. The flag is
 * kept as a single switch so the request can be disabled again without
 * touching {@link fetchRecommendedRepos}.
 */
const CATALOGUE_PUBLISHED = true;

/**
 * Validation block carried by every EXTERNAL registry entry (the federated
 * search only serves a snapshot whose ``status`` is ``"validated"``). The
 * official ``self`` entry is exempt — its own CI validates every push.
 */
export interface RepoValidation {
  /** ``pending`` = submitted, not yet green; ``validated`` = the pinned
   *  commit passed; ``rejected`` = failed, kept for the record. */
  status: "pending" | "validated" | "rejected";
  /** ISO-8601 timestamp of when the pinned commit was validated. */
  validated_at: string;
  /** ``learn-content-engine`` version the snapshot was validated against. */
  engine_version?: string;
  /** ``schema_version`` of the repo's ``search-index.json`` at the pin. */
  index_schema_version?: string;
  notes?: string;
}

/**
 * One entry in the federated content-repo registry (``recommended-repos.json``).
 *
 * The single ``self`` entry describes the official repo (branch-tracked, no
 * commit / validation — validated by its own CI). Every OTHER entry is an
 * external repo that MUST pin the exact validated ``commit`` and carry a
 * {@link RepoValidation} block; the federated search reads that repo's
 * ``search-index.json`` at the pinned commit, and only when its status is
 * ``"validated"``.
 */
export interface RecommendedRepo {
  /** Canonical ``https://github.com/owner/repo`` URL (also accepts an
   *  ``owner/repo`` shorthand for backward-compat with the pre-governance
   *  catalogue). */
  url: string;
  /** Branch the pinned commit must be reachable from. Defaults to ``main``. */
  branch: string;
  /** Optional display title + description for the discovery / add card. */
  title?: string;
  description?: string;
  /** Curation trust: 1 = community/unverified, 2 = reviewed, 3 = official.
   *  External repos start at 1; the official ``self`` entry is 3. */
  trust_level?: number;
  /** Language pairs the repo advertises, e.g. ``["de-fr", "de-es"]``. */
  languages?: string[];
  /** True ONLY on the official ``self`` entry — branch-tracked, exempt from
   *  the pinned-commit + validation requirement. */
  self?: boolean;
  /** Full 40-char git SHA of the validated snapshot (external entries).
   *  The federated search reads ``search-index.json`` AT this commit. */
  commit?: string;
  /** Validation block (external entries). */
  validation?: RepoValidation;
}

/**
 * Whether an entry participates in the FEDERATED SEARCH. The official ``self``
 * entry always does (branch-tracked, CI-validated); every external entry does
 * only once its pinned commit has passed validation
 * (``validation.status === "validated"``). Pre-governance entries (no ``self``,
 * no ``validation``) are NOT searchable — they may still be listed as
 * "recommended" to add, but the search only ever serves a validated snapshot.
 */
export function isValidatedForSearch(rec: RecommendedRepo): boolean {
  if (rec.self === true) return true;
  return rec.validation?.status === "validated";
}

/**
 * The git ref to read a registry entry's content at: the branch for the
 * branch-tracked ``self`` entry, else the pinned ``commit`` (falling back to
 * the branch only when — against the contract — no commit was pinned).
 */
export function recommendedRef(rec: RecommendedRepo): string {
  if (rec.self) return rec.branch || "main";
  return rec.commit || rec.branch || "main";
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
