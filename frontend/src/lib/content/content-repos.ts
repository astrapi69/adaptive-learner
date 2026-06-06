/**
 * User content-repository configuration + source helpers (EXP-023 Phase A).
 *
 * Phase A lets a learner connect ONE own GitHub content repository in
 * addition to the official ``astrapi69/adaptive-learner-content``. The
 * official repo stays the default and is never removable.
 *
 * The content loader already keys cached sets by a ``source`` string
 * (the repo identifier, e.g. ``"astrapi69/adaptive-learner-content"`` or
 * ``"bundled:..."``). Rather than introduce a parallel
 * ``"official" | "user-repo"`` enum, Phase A keeps that model and derives
 * the distinction via {@link isOfficialSource}. A user repo's source is
 * simply ``"{owner}/{repo}"`` — the same shape as the official source —
 * so the existing dedupe / cache-key machinery works unchanged.
 *
 * The connection config is persisted in the ``content-loader`` plugin
 * settings (Dexie ``pluginSettings`` table / API
 * ``PATCH /api/plugin-settings/content-loader``), alongside the existing
 * ``default_sources``. Both storage modes go through
 * ``getStorage().pluginSettings`` so the same code path serves API and
 * Dexie deployments.
 */

import { getStorage } from "../../storage";

/** Plugin whose settings hold the content sources + the user repo. */
export const CONTENT_LOADER_PLUGIN = "content-loader";

/** Canonical identifier of the official content repository. */
export const OFFICIAL_SOURCE = "astrapi69/adaptive-learner-content";

/** Prefix marking a build-time bundled source (also "official"). */
export const BUNDLED_PREFIX = "bundled:";

/**
 * Persisted connection config for the user's own content repository.
 * Stored under ``content-loader`` plugin settings key ``user_repo``.
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
}

/**
 * True when a cached set's ``source`` belongs to the official content
 * (the canonical repo or any bundled source). Everything else — i.e. the
 * user's own repo — is treated as user content for badges + filtering.
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
 * Accepts the common forms a user might paste:
 * - ``https://github.com/owner/repo`` (with optional ``.git`` / sub-path)
 * - ``git@github.com:owner/repo.git`` (SSH)
 * - ``owner/repo`` (shorthand)
 *
 * Returns ``null`` when the input is empty or not a recognisable
 * owner/repo pair so the caller can show a validation error.
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

/**
 * The ``source`` identifier for a user repo: ``"{owner}/{repo}"`` — the
 * same shape the content loader uses for the official GitHub source.
 */
export function userRepoSource(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

/**
 * Namespace a set id with the repo owner (``{username}/{set}``) so a user
 * repo's sets cannot collide with the official ones (or, in Phase B, with
 * other community repos). Official sets keep their bare id.
 */
export function namespacedSetId(owner: string, setId: string): string {
  return `${owner}/${setId}`;
}

/** Auto-sync threshold: re-sync a connected user repo on app start when
 *  the last sync is older than this (EXP-023 Phase A). */
export const SYNC_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * True when a connected repo is due for an automatic sync: never synced,
 * or last synced more than {@link SYNC_THRESHOLD_MS} ago. An unparseable
 * timestamp is treated as due (re-sync rather than skip forever).
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

/**
 * Read the persisted user-repo config, or ``null`` when none is
 * configured. Never throws — a missing/oversized settings row resolves to
 * ``null`` so the UI degrades to the "not connected" state.
 */
export async function readUserRepo(): Promise<UserContentRepo | null> {
  try {
    const { settings } = await getStorage().pluginSettings.get(
      CONTENT_LOADER_PLUGIN,
    );
    const raw = (settings as Record<string, unknown>)?.user_repo;
    if (!raw || typeof raw !== "object") return null;
    return raw as UserContentRepo;
  } catch {
    return null;
  }
}

/**
 * Persist (or clear, when ``repo`` is null) the user-repo config without
 * clobbering the rest of the plugin's settings (notably
 * ``default_sources``). Reads the current settings, merges, writes back.
 */
export async function writeUserRepo(
  repo: UserContentRepo | null,
): Promise<void> {
  const storage = getStorage();
  const { settings } = await storage.pluginSettings.get(CONTENT_LOADER_PLUGIN);
  const next: Record<string, unknown> = { ...(settings ?? {}) };
  if (repo) {
    next.user_repo = repo;
  } else {
    delete next.user_repo;
  }
  await storage.pluginSettings.update(CONTENT_LOADER_PLUGIN, { settings: next });
}

/** Result of a {@link syncUserRepo} run. */
export interface SyncResult {
  setCount: number;
  lessonCount: number;
}

/**
 * Download + cache every set the connected user repo advertises, then
 * persist the refreshed counts + ``last_synced``. Storage-agnostic: it
 * goes through ``getStorage().contentLoader`` so Dexie caches to IndexedDB
 * and API mode caches on the backend filesystem — both already include the
 * user repo in their active sources.
 *
 * Throws when no repo is connected (the caller gates the Sync button on a
 * connected repo).
 */
export async function syncUserRepo(): Promise<SyncResult> {
  const config = await readUserRepo();
  if (!config) {
    throw new Error("No user content repository is connected.");
  }
  const source = userRepoSource(config.owner, config.repo);
  const storage = getStorage();
  const { sets } = await storage.contentLoader.listSets();
  const userSets = sets.filter((entry) => entry.source === source);
  let lessonCount = 0;
  for (const entry of userSets) {
    await storage.contentLoader.downloadSet(entry.source, entry.id);
    lessonCount += entry.lesson_count ?? 0;
  }
  const updated: UserContentRepo = {
    ...config,
    connected: true,
    last_synced: new Date().toISOString(),
    set_count: userSets.length,
    lesson_count: lessonCount,
  };
  await writeUserRepo(updated);
  return { setCount: userSets.length, lessonCount };
}
