/**
 * Search-index loader for Content Discovery (EXP-034 / DIS-04).
 *
 * A content repo publishes a lean ``search-index.json`` at its root (~4 KB,
 * metadata only — no card content). This module fetches those indices so a
 * learner can FIND material before downloading it (the ``npm search`` half
 * of the flow; the actual download is DIS-06).
 *
 * Design constraints (see ``.claude/rules/reusability.md`` Library-First and
 * the EXP-034 exploration doc):
 *  - **No server**, everything client-side.
 *  - **CORS-safe**: reuses {@link buildFileRequest} so a public repo is read
 *    from ``raw.githubusercontent.com`` with NO custom headers (no preflight);
 *    a tokened private repo uses the ``api.github.com`` contents endpoint.
 *  - **Cached** in localStorage with a 24 h TTL.
 *  - **Stale-while-revalidate**: a stale cache is returned immediately and
 *    refreshed in the background (the caller learns of the refresh via
 *    {@link FetchSearchIndexOptions.onRevalidated}).
 *  - **Offline-tolerant + crash-free**: a failed fetch falls back to the
 *    cached index, or an empty array — never throws to the caller.
 *  - **Parallel with a cap**: {@link fetchAllIndices} loads at most
 *    {@link MAX_CONCURRENT_INDEX_FETCHES} repos at once (the rest queue).
 *
 * Pure + dependency-light so it is unit-testable: the only side effects are
 * the network fetch (mockable via global ``fetch``) and localStorage.
 */

import { parseGitHubRepoUrl } from "./content-repos";
import { buildFileRequest, fetchWithRetry } from "./github-fetch";
import type { SetReviewStatus, SetVisibility } from "../../../storage/types";

/** The conventional index filename at a content repo's root. */
export const SEARCH_INDEX_FILE = "search-index.json";

/** Cache time-to-live: refresh a cached index older than this when online. */
export const SEARCH_INDEX_TTL_MS = 24 * 60 * 60 * 1000;

/** Max repos fetched in parallel by {@link fetchAllIndices} (the rest queue). */
export const MAX_CONCURRENT_INDEX_FETCHES = 10;

const CACHE_PREFIX = "adaptive-learner.search_index::";

/** Optional book-companion metadata carried in the index. */
export interface SearchIndexBook {
  title: string;
  author?: string | null;
}

/**
 * One set as advertised by a repo's ``search-index.json``, enriched with the
 * repo it came from. This is the unit the discovery UI searches + filters.
 */
export interface SearchableSet {
  id: string;
  name: string;
  description: string;
  source_language: string;
  target_language: string;
  level: string;
  domain: string;
  lesson_count: number;
  card_count: number;
  tags: string[];
  ai_validated: boolean;
  /** Technical/curation trust level (0 unknown .. 3 officially recommended). */
  trust_level: number;
  book: SearchIndexBook | null;
  /** ISO-8601 last-update timestamp, or null when the index omits it. */
  updated_at: string | null;
  /** ``owner/repo`` source identifier the set came from. */
  repo_url: string;
  /** Display name for the repo (a curated title, else ``owner/repo``). */
  repo_name: string;
  /** #1707 — consumer-display visibility advertised by the index entry.
   *  ``"hidden"`` marks a conformance/reference fixture; such entries are
   *  dropped at parse time so they never enter the catalogue. Absent ⇒
   *  visible. */
  visibility?: SetVisibility;
  /** #2299 — review standing advertised by the index entry (engine schema
   *  1.9). ``"generated"`` is machine-generated with the review pending,
   *  ``"reviewed"`` is machine-generated and reviewed, ``"authored"`` is
   *  hand-written and needs none. Absent or out-of-enum ⇒ ``"authored"``,
   *  matching the engine + index-generator normalisation. */
  review_status: SetReviewStatus;
}

/** A content repo to load a search index from. */
export interface SearchIndexRepo {
  /** ``owner/repo`` shorthand or a full GitHub URL. */
  url: string;
  /** Branch to read from. Defaults to ``main``. */
  branch?: string;
  /** Exact git ref (a pinned commit SHA) to read the index at, overriding
   *  ``branch``. The federated registry pins every EXTERNAL repo to its
   *  validated commit; the branch-tracked official repo omits it. */
  ref?: string;
  /** Optional display name for {@link SearchableSet.repo_name}. */
  name?: string;
  /** Optional read token for a private / coach repo (empty = public). */
  token?: string;
  /** Registry-declared repo trust level (1 community .. 3 official) used as a
   *  FLOOR for the trust of every set in this repo, so the governance trust
   *  drives ranking even when a set's own index omits it. */
  trustLevel?: number;
}

interface ResolvedRepo {
  source: string;
  /** The ref the index is read at (pinned commit, else branch). */
  ref: string;
  name: string;
  token: string;
  /** Minimum trust applied to every set from this repo. */
  trustFloor: number;
}

interface CachedIndex {
  cachedAt: number;
  sets: SearchableSet[];
}

function cacheKey(source: string): string {
  return CACHE_PREFIX + source;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** The review-standing values the index may advertise (engine schema 1.9). */
const REVIEW_STATUS_VALUES: readonly SetReviewStatus[] = [
  "authored",
  "generated",
  "reviewed",
];

/**
 * Normalise the index entry's ``review_status`` the way the engine and the
 * index generator do: absent, non-string or out-of-enum all mean
 * ``"authored"``. Both ends of the chain must read a missing field the same
 * way, otherwise a set that says nothing means different things per layer.
 */
function asReviewStatus(value: unknown): SetReviewStatus {
  return REVIEW_STATUS_VALUES.includes(value as SetReviewStatus)
    ? (value as SetReviewStatus)
    : "authored";
}

function asBook(value: unknown): SearchIndexBook | null {
  if (!value || typeof value !== "object") return null;
  const book = value as { title?: unknown; author?: unknown };
  if (typeof book.title !== "string") return null;
  return {
    title: book.title,
    author: typeof book.author === "string" ? book.author : null,
  };
}

function normalizeSet(
  raw: Record<string, unknown>,
  repoSource: string,
  repoName: string,
  trustFloor: number,
): SearchableSet | null {
  const id = asString(raw.id);
  if (!id) return null;
  // #1707 — the index entry declares its own ``visibility`` (engine-normalised
  // to "visible"/"hidden"). Drop a set the repo marks ``hidden`` (a
  // conformance/reference fixture) at parse time, so it never enters the
  // Discover catalogue, its facets/counts, or the written cache. Absent / any
  // other value ⇒ visible. Replaces the app-side ``hidden-sets.ts`` blocklist.
  const visibility: SetVisibility =
    asString(raw.visibility) === "hidden" ? "hidden" : "visible";
  if (visibility === "hidden") return null;
  return {
    id,
    name: asString(raw.name) || id,
    description: asString(raw.description),
    source_language: asString(raw.source_language),
    target_language: asString(raw.target_language),
    level: asString(raw.level),
    domain: asString(raw.domain) || "language",
    lesson_count: asNumber(raw.lesson_count),
    card_count: asNumber(raw.card_count),
    tags: asStringArray(raw.tags),
    ai_validated: raw.ai_validated === true,
    // The registry's repo-level trust is a floor: a set never ranks below
    // the governance trust of the repo it came from.
    trust_level: Math.max(asNumber(raw.trust_level), trustFloor),
    book: asBook(raw.book),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    repo_url: repoSource,
    repo_name: repoName,
    visibility,
    review_status: asReviewStatus(raw.review_status),
  };
}

/**
 * Parse a ``search-index.json`` payload into validated {@link SearchableSet}s.
 * Pure + never throws: a non-array ``sets`` field resolves to ``[]`` and any
 * entry without a string ``id`` is dropped. ``trustFloor`` (default 0) is the
 * registry-declared repo trust applied as a minimum to every set.
 */
export function parseSearchIndex(
  data: unknown,
  repoSource: string,
  repoName: string,
  trustFloor = 0,
): SearchableSet[] {
  const sets = (data as { sets?: unknown } | null | undefined)?.sets;
  if (!Array.isArray(sets)) return [];
  return sets
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => normalizeSet(s, repoSource, repoName, trustFloor))
    .filter((s): s is SearchableSet => s !== null);
}

function resolveRepo(repo: SearchIndexRepo): ResolvedRepo | null {
  const parsed = parseGitHubRepoUrl(repo.url);
  if (!parsed) return null;
  const source = `${parsed.owner}/${parsed.repo}`;
  return {
    source,
    // A pinned commit (``ref``) wins over the branch so the federated search
    // always reads the exact validated snapshot; the official repo omits it
    // and stays branch-tracked.
    ref: repo.ref || repo.branch || "main",
    name: repo.name || source,
    token: repo.token || "",
    trustFloor: repo.trustLevel ?? 0,
  };
}

/** Read the cached index for ``source``, flagging whether it is past TTL. */
export function readSearchIndexCache(
  source: string,
  now: number = Date.now(),
): { sets: SearchableSet[]; stale: boolean } | null {
  try {
    const raw = localStorage.getItem(cacheKey(source));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedIndex;
    if (
      !parsed ||
      typeof parsed.cachedAt !== "number" ||
      !Array.isArray(parsed.sets)
    ) {
      return null;
    }
    return { sets: parsed.sets, stale: now - parsed.cachedAt > SEARCH_INDEX_TTL_MS };
  } catch {
    return null;
  }
}

/** Persist the index for ``source``. Never throws (storage may be unavailable). */
export function writeSearchIndexCache(
  source: string,
  sets: SearchableSet[],
  now: number = Date.now(),
): void {
  try {
    const record: CachedIndex = { cachedAt: now, sets };
    localStorage.setItem(cacheKey(source), JSON.stringify(record));
  } catch {
    /* storage unavailable — index simply not cached */
  }
}

/** Drop the cached index for ``source`` (e.g. when a repo is removed). */
export function clearSearchIndexCache(source: string): void {
  try {
    localStorage.removeItem(cacheKey(source));
  } catch {
    /* ignore */
  }
}

/**
 * Fetch + parse ``search-index.json`` straight from the network (no cache).
 * Throws on an unresolvable URL only via an empty result; throws on a non-OK
 * HTTP response so the caller's stale-while-revalidate / cache-miss branches
 * can decide what to do.
 */
export async function fetchSearchIndexFromNetwork(
  repo: SearchIndexRepo,
): Promise<SearchableSet[]> {
  const resolved = resolveRepo(repo);
  if (!resolved) return [];
  const { url, init } = buildFileRequest(
    resolved.source,
    resolved.ref,
    SEARCH_INDEX_FILE,
    resolved.token,
  );
  const response = await fetchWithRetry(url, init);
  if (!response.ok) {
    throw new Error(`search-index.json HTTP ${response.status} for ${resolved.source}`);
  }
  const data = await response.json();
  return parseSearchIndex(data, resolved.source, resolved.name, resolved.trustFloor);
}

/** Options for {@link fetchSearchIndex} / {@link fetchAllIndices}. */
export interface FetchSearchIndexOptions {
  /** Injected clock for deterministic TTL tests. */
  now?: number;
  /** Fired when a stale-while-revalidate background refresh completes with
   *  fresh sets, so the UI can update after returning the cached index. */
  onRevalidated?: (sets: SearchableSet[]) => void;
  /** Force a network refetch, IGNORING the TTL cache (used when the catalogue
   *  must reflect the live repo now — e.g. a user-triggered sync or a Discover
   *  reopen after new content was published). The fresh result replaces the
   *  cache; on a network failure the cached sets are returned instead of an
   *  empty list, so a failed refresh never blanks the catalogue (#1337). */
  forceRefresh?: boolean;
}

async function revalidate(
  repo: SearchIndexRepo,
  source: string,
  now: number,
  onRevalidated?: (sets: SearchableSet[]) => void,
): Promise<void> {
  try {
    const sets = await fetchSearchIndexFromNetwork(repo);
    writeSearchIndexCache(source, sets, now);
    onRevalidated?.(sets);
  } catch {
    /* offline / failed during revalidate — keep the stale cache as-is */
  }
}

/**
 * Load one repo's search index with stale-while-revalidate caching.
 *
 *  - ``forceRefresh``: skip the cache entirely and refetch from the network,
 *    updating the cache. On a network failure the cached sets (if any) are
 *    returned, so a failed forced refresh never blanks the catalogue (#1337).
 *  - Fresh cache (within {@link SEARCH_INDEX_TTL_MS}): returned with NO network.
 *  - Stale cache: returned immediately; a background refresh updates the cache
 *    and calls {@link FetchSearchIndexOptions.onRevalidated} on success.
 *  - No cache: fetched synchronously, cached, returned. A fetch failure (offline
 *    / 404 / CORS) resolves to ``[]`` without caching, so the next call retries.
 *
 * Never throws — an unresolvable URL or a network error degrades to the cached
 * sets, or ``[]``.
 */
export async function fetchSearchIndex(
  repo: SearchIndexRepo,
  opts: FetchSearchIndexOptions = {},
): Promise<SearchableSet[]> {
  const now = opts.now ?? Date.now();
  const resolved = resolveRepo(repo);
  if (!resolved) return [];

  if (opts.forceRefresh) {
    // Catalogue must reflect the live repo now: ignore the TTL cache and
    // refetch. A failed refetch falls back to the cache so the catalogue
    // never blanks (#1337).
    try {
      const sets = await fetchSearchIndexFromNetwork(repo);
      writeSearchIndexCache(resolved.source, sets, now);
      opts.onRevalidated?.(sets);
      return sets;
    } catch {
      return readSearchIndexCache(resolved.source, now)?.sets ?? [];
    }
  }

  const cached = readSearchIndexCache(resolved.source, now);
  if (cached && !cached.stale) {
    return cached.sets;
  }
  if (cached && cached.stale) {
    void revalidate(repo, resolved.source, now, opts.onRevalidated);
    return cached.sets;
  }

  try {
    const sets = await fetchSearchIndexFromNetwork(repo);
    writeSearchIndexCache(resolved.source, sets, now);
    return sets;
  } catch {
    return [];
  }
}

/**
 * Run ``fn`` over ``items`` with at most ``limit`` in flight at once, queuing
 * the rest. Results preserve input order. Used to cap parallel index fetches.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  };
  const workerCount = Math.max(0, Math.min(limit, items.length));
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

/** Options for {@link fetchAllIndices}. */
export interface FetchAllIndicesOptions extends FetchSearchIndexOptions {
  /** Max concurrent repo fetches (default {@link MAX_CONCURRENT_INDEX_FETCHES}). */
  concurrency?: number;
}

/**
 * Load the search indices of every repo in parallel (capped concurrency) and
 * return all their sets, flat. Each repo is loaded via {@link fetchSearchIndex}
 * so caching + stale-while-revalidate + offline tolerance apply per repo; a
 * single failing repo contributes ``[]`` and never fails the batch.
 */
export async function fetchAllIndices(
  repos: SearchIndexRepo[],
  opts: FetchAllIndicesOptions = {},
): Promise<SearchableSet[]> {
  const limit = opts.concurrency ?? MAX_CONCURRENT_INDEX_FETCHES;
  const perRepo = await mapWithConcurrency(repos, limit, (repo) =>
    fetchSearchIndex(repo, opts),
  );
  return perRepo.flat();
}
