/**
 * User content-repository configuration + source helpers (EXP-023).
 *
 * Phase A connected ONE own GitHub content repository; Phase B (#122)
 * generalises this to a LIST of user repos, each connectable, syncable,
 * removable, and reorderable (order = collision precedence). The official
 * ``astrapi69/adaptive-learner-content`` stays the default base and is
 * never part of this list.
 *
 * The content loader keys cached sets by a ``source`` string (the repo
 * identifier, e.g. ``"owner/repo"`` or ``"bundled:..."``). Official-vs-user
 * is derived via {@link isOfficialSource} — no parallel enum. A user repo's
 * source is ``"{owner}/{repo}"``, the same shape as the official source.
 *
 * Config persists in the ``content-loader`` plugin settings under
 * ``user_repos`` (Dexie ``pluginSettings`` / API ``plugin-settings``),
 * alongside ``default_sources``. {@link readUserRepos} migrates a Phase A
 * single ``user_repo`` into the array transparently.
 */

import { getStorage } from "../../storage";

/** Plugin whose settings hold the content sources + the user repos. */
export const CONTENT_LOADER_PLUGIN = "content-loader";

/** Canonical identifier of the official content repository. */
export const OFFICIAL_SOURCE = "astrapi69/adaptive-learner-content";

/** Prefix marking a build-time bundled source (also "official"). */
export const BUNDLED_PREFIX = "bundled:";

/**
 * Technical trust level (EXP-023 Phase B): 0 = unknown (freshly added,
 * not yet validated), 1 = technically validated (all checks passed).
 */
export type TrustLevel = 0 | 1;

/**
 * Persisted connection config for one user content repository.
 * Stored as an element of ``content-loader`` settings ``user_repos``.
 */
export interface UserContentRepo {
  /** The GitHub URL exactly as the user entered it (for display). */
  url: string;
  /** Parsed repository owner (the GitHub username / org). */
  owner: string;
  /** Parsed repository name. */
  repo: string;
  /** Branch to read from. Defaults to ``main``. */
  branch: string;
  /** True once a sync has successfully cached the repo's content. */
  connected: boolean;
  /** ISO-8601 timestamp of the last successful sync, or null. */
  last_synced: string | null;
  /** Number of sets found at the last sync. */
  set_count: number;
  /** Number of lessons found at the last sync. */
  lesson_count: number;
  /** EXP-023 Phase B — technical trust level (0 unknown, 1 validated). */
  trust?: TrustLevel;
  /** EXP-023 Phase B — true when a private (coach) token was supplied for
   *  this repo, so the Browser can show a "Coach" badge. The token itself
   *  is NOT stored here (it lives in the per-repo token store, out of the
   *  exportable settings); this is only the cosmetic flag. */
  coach?: boolean;
}

/**
 * True when a cached set's ``source`` belongs to the official content
 * (the canonical repo or any bundled source). Everything else — a user
 * repo — is user content for badges + filtering.
 */
export function isOfficialSource(source: string): boolean {
  return source === OFFICIAL_SOURCE || source.startsWith(BUNDLED_PREFIX);
}

/** Parsed ``{owner, repo}`` from a GitHub repository reference. */
export interface ParsedRepo {
  owner: string;
  repo: string;
}

/**
 * Parse a GitHub repository reference into ``{owner, repo}``.
 *
 * Accepts ``https://github.com/owner/repo`` (optional ``.git`` / sub-path),
 * ``git@github.com:owner/repo.git`` (SSH), and ``owner/repo`` (shorthand).
 * Returns ``null`` for empty / unrecognisable input.
 */
export function parseGitHubRepoUrl(input: string): ParsedRepo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const patterns = [
    /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/,
    /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:\/.*)?$/,
    /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?$/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const owner = match[1];
      const repo = match[2];
      if (owner && repo) return { owner, repo };
    }
  }
  return null;
}

/** The ``source`` identifier for a user repo: ``"{owner}/{repo}"``. */
export function userRepoSource(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

/**
 * Namespace a set id with the repo owner (``{username}/{set}``) so sets
 * from different repos cannot collide. Official sets keep their bare id.
 */
export function namespacedSetId(owner: string, setId: string): string {
  return `${owner}/${setId}`;
}

/** Auto-sync threshold: re-sync a connected repo whose last sync is older
 *  than this (EXP-023 Phase A). */
export const SYNC_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * True when a connected repo is due for an automatic sync: never synced,
 * or last synced more than {@link SYNC_THRESHOLD_MS} ago. An unparseable
 * timestamp is treated as due.
 */
export function isUserRepoSyncDue(
  lastSynced: string | null,
  now: number = Date.now(),
): boolean {
  if (!lastSynced) return true;
  const when = Date.parse(lastSynced);
  if (Number.isNaN(when)) return true;
  return now - when > SYNC_THRESHOLD_MS;
}

/** Narrow an unknown settings value to a UserContentRepo (best-effort). */
function asRepo(raw: unknown): UserContentRepo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<UserContentRepo>;
  if (!r.owner || !r.repo) return null;
  return r as UserContentRepo;
}

/**
 * Read the connected user repos as a list, migrating a Phase A single
 * ``user_repo`` into the array shape. Never throws — resolves to ``[]`` on
 * any read error so the UI degrades to "no repos".
 */
export async function readUserRepos(): Promise<UserContentRepo[]> {
  try {
    const { settings } = await getStorage().pluginSettings.get(
      CONTENT_LOADER_PLUGIN,
    );
    const bag = settings as Record<string, unknown>;
    const list = bag?.user_repos;
    if (Array.isArray(list)) {
      return list.map(asRepo).filter((r): r is UserContentRepo => r !== null);
    }
    // Phase A migration: a single ``user_repo`` object.
    const legacy = asRepo(bag?.user_repo);
    return legacy ? [legacy] : [];
  } catch {
    return [];
  }
}

/**
 * Persist the full user-repo list without clobbering the rest of the
 * plugin settings (notably ``default_sources``). Drops the legacy Phase A
 * ``user_repo`` key so the array becomes the single source of truth.
 */
export async function writeUserRepos(repos: UserContentRepo[]): Promise<void> {
  const storage = getStorage();
  const { settings } = await storage.pluginSettings.get(CONTENT_LOADER_PLUGIN);
  const next: Record<string, unknown> = { ...(settings ?? {}) };
  next.user_repos = repos;
  delete next.user_repo;
  await storage.pluginSettings.update(CONTENT_LOADER_PLUGIN, { settings: next });
}

/** Find a connected repo by its ``owner/repo`` source, or null. */
export async function findUserRepo(
  source: string,
): Promise<UserContentRepo | null> {
  const repos = await readUserRepos();
  return repos.find((r) => userRepoSource(r.owner, r.repo) === source) ?? null;
}

/**
 * Add a repo to the list (highest precedence — appended last). Replaces an
 * existing entry with the same ``owner/repo``. Returns the updated list.
 */
export async function addUserRepo(
  repo: UserContentRepo,
): Promise<UserContentRepo[]> {
  const source = userRepoSource(repo.owner, repo.repo);
  const repos = (await readUserRepos()).filter(
    (r) => userRepoSource(r.owner, r.repo) !== source,
  );
  repos.push(repo);
  await writeUserRepos(repos);
  return repos;
}

/** Remove the repo with the given ``owner/repo`` source. */
export async function removeUserRepo(
  source: string,
): Promise<UserContentRepo[]> {
  const repos = (await readUserRepos()).filter(
    (r) => userRepoSource(r.owner, r.repo) !== source,
  );
  await writeUserRepos(repos);
  return repos;
}

/**
 * Move a repo up (-1) or down (+1) in the list. Order = collision
 * precedence (later in the list wins). No-op at the boundaries.
 */
export async function moveUserRepo(
  source: string,
  direction: -1 | 1,
): Promise<UserContentRepo[]> {
  const repos = await readUserRepos();
  const index = repos.findIndex(
    (r) => userRepoSource(r.owner, r.repo) === source,
  );
  if (index === -1) return repos;
  const target = index + direction;
  if (target < 0 || target >= repos.length) return repos;
  [repos[index], repos[target]] = [repos[target], repos[index]];
  await writeUserRepos(repos);
  return repos;
}

/** Result of a {@link syncUserRepo} run. */
export interface SyncResult {
  setCount: number;
  lessonCount: number;
}

/**
 * Download + cache every set ONE user repo advertises, then persist its
 * refreshed counts + ``last_synced``. Storage-agnostic (goes through
 * ``getStorage().contentLoader``); both modes already include the repo in
 * their active sources. Throws when the source is not in the list.
 */
export async function syncUserRepo(source: string): Promise<SyncResult> {
  const repos = await readUserRepos();
  const index = repos.findIndex(
    (r) => userRepoSource(r.owner, r.repo) === source,
  );
  if (index === -1) {
    throw new Error(`Repository ${source} is not connected.`);
  }
  const storage = getStorage();
  const { sets } = await storage.contentLoader.listSets();
  const repoSets = sets.filter((entry) => entry.source === source);
  let lessonCount = 0;
  for (const entry of repoSets) {
    await storage.contentLoader.downloadSet(entry.source, entry.id);
    lessonCount += entry.lesson_count ?? 0;
  }
  repos[index] = {
    ...repos[index],
    connected: true,
    last_synced: new Date().toISOString(),
    set_count: repoSets.length,
    lesson_count: lessonCount,
  };
  await writeUserRepos(repos);
  return { setCount: repoSets.length, lessonCount };
}
