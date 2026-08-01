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

import { getStorage } from "../../../storage";
import { assessSetUpdate } from "../update/assess-set-update";
import { listRepoManifestSets, validateUserRepo } from "./content-repo-validate";
import { resolveRepoToken } from "./repo-token";
import {
  BUNDLED_PREFIX,
  isOfficialSource,
  OFFICIAL_SOURCE,
} from "./source-identity";

/** Re-exported from {@link ./source-identity} so existing importers of
 *  ``./content-repos`` keep working; the canonical definitions live in the
 *  cycle-free leaf module shared with ``repo-token``. */
export { BUNDLED_PREFIX, isOfficialSource, OFFICIAL_SOURCE };

/** Plugin whose settings hold the content sources + the user repos. */
export const CONTENT_LOADER_PLUGIN = "content-loader";

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
  /** #1093 — true when this repo was added by redeeming an invitation code.
   *  The learner is a guest, not the owner: re-share / Teilen controls are
   *  hidden for invite-added repos (only the owner shares). */
  shared_via_invite?: boolean;
}

/**
 * Unified, typed trust-/origin category for an imported content source (#1319).
 * Consolidates the previously-scattered signals (official source, recommended,
 * coach token, technical trust) into one value so the UI shows a single,
 * consistent badge instead of ad-hoc inline conditionals:
 *
 *   - ``official``   — provided/endorsed by us (the canonical or bundled repo,
 *                      or an officially-recommended repo).
 *   - ``private``    — the user's own / a coach repo, added with a private token.
 *   - ``validated``  — a community repo that passed the technical validation.
 *   - ``unverified`` — a community repo not yet validated (freshly added).
 */
export type RepoCategory = "official" | "private" | "validated" | "unverified";

/** Signals {@link resolveRepoCategory} derives the category from. All optional
 *  except ``source`` so callers can pass a bare source or a full repo. */
export interface RepoCategoryInputs {
  /** The cached-set / repo ``source`` (``owner/repo`` or ``bundled:…``). */
  source: string;
  /** Technical trust level (``UserContentRepo.trust``). */
  trust?: TrustLevel;
  /** Whether a private (coach) token was supplied (``UserContentRepo.coach``). */
  coach?: boolean;
  /** Whether the source is officially recommended (``isRecommendedSource``). */
  recommended?: boolean;
}

/**
 * Derive the {@link RepoCategory} for a source. Pure + precedence-ordered so a
 * source maps to exactly one category: official (origin) wins over private
 * (origin) wins over the trust axis (validated / unverified). App-agnostic —
 * no storage/i18n; the caller passes the already-known signals.
 */
export function resolveRepoCategory(inputs: RepoCategoryInputs): RepoCategory {
  if (isOfficialSource(inputs.source) || inputs.recommended) return "official";
  if (inputs.coach) return "private";
  if (inputs.trust === 1) return "validated";
  return "unverified";
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
  /** Trust level after the sync's automatic re-validation. */
  trust: TrustLevel;
}

/** Phase of a {@link syncUserRepo} run, for a progress indicator (#645). */
export type SyncPhase = "manifest" | "sets" | "lessons" | "validate";

/** Progress event emitted during a {@link syncUserRepo} run. ``total`` is 0
 *  until the set list is known; ``current`` counts sets cached so far. */
export interface SyncProgress {
  phase: SyncPhase;
  current: number;
  total: number;
}

/**
 * i18n key + English fallback for a sync {@link SyncPhase}, so every surface
 * that renders sync progress (Settings, the ``/add-repo`` deep link) labels
 * the phases identically (#645). UI-framework-free: the caller passes the
 * result through its own ``t()``.
 */
export function syncPhaseI18n(phase: SyncPhase): {
  key: string;
  fallback: string;
} {
  switch (phase) {
    case "manifest":
      return { key: "content_repo.progress.manifest", fallback: "Loading manifest…" };
    case "sets":
      return { key: "content_repo.progress.sets", fallback: "Loading sets…" };
    case "lessons":
      return { key: "content_repo.progress.lessons", fallback: "Caching lessons…" };
    case "validate":
      return { key: "content_repo.progress.validate", fallback: "Verifying content…" };
  }
}

/**
 * Download + cache every set ONE user repo advertises, re-validate it, and
 * persist refreshed counts + ``last_synced`` + ``trust``. Storage-agnostic
 * (via ``getStorage().contentLoader``); both modes already include the repo
 * in their active sources. Re-validation runs on every sync — a repo that
 * stops passing drops to trust 0 (the caller can warn). Throws when the
 * source is not in the list.
 *
 * @param source The ``owner/repo`` source to sync.
 * @param onProgress Optional callback fired as the sync advances through its
 *   phases, so the UI can render a progress indicator (#645).
 */
export async function syncUserRepo(
  source: string,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  const report = (phase: SyncPhase, current: number, total: number): void => {
    onProgress?.({ phase, current, total });
  };
  const repos = await readUserRepos();
  const index = repos.findIndex(
    (r) => userRepoSource(r.owner, r.repo) === source,
  );
  if (index === -1) {
    throw new Error(`Repository ${source} is not connected.`);
  }
  const target = repos[index];
  const storage = getStorage();
  report("manifest", 0, 0);
  // #1388 — read the set list from the TARGET repo's own manifest.yaml.
  // The previous listSets() walk fetched the manifests of EVERY configured
  // source over the network, so one row's sync effectively synced all
  // repos. An unreachable target repo throws here — the caller reports it
  // at the affected row; nothing has been written yet.
  const manifestSets = await listRepoManifestSets(
    { owner: target.owner, repo: target.repo, branch: target.branch },
    resolveRepoToken(source),
  );
  report("sets", 0, manifestSets.length);
  let lessonCount = 0;
  let done = 0;
  for (const manifestSet of manifestSets) {
    // #2128 — a background sync must NEVER silently overwrite a set whose
    // update would orphan the learner's progress/SRS. Hold such a set at its
    // cached version (its ``update_available`` flag stays true, so it is
    // visible + re-decidable via the manual "Update" button, which warns with
    // counts). A harmless update (superset / no learner data) applies as
    // before. A peek/read failure holds too — better a delayed update than a
    // silent loss; the next cycle or a manual update retries.
    let held: boolean;
    try {
      held = (await assessSetUpdate(source, manifestSet.id))?.impact.breaking ?? false;
    } catch {
      held = true;
    }
    if (!held) {
      await storage.contentLoader.downloadSet(source, manifestSet.id);
      lessonCount += manifestSet.lessonCount;
    }
    done += 1;
    report("lessons", done, manifestSets.length);
  }
  report("validate", manifestSets.length, manifestSets.length);
  const validation = await validateUserRepo(
    { owner: target.owner, repo: target.repo, branch: target.branch },
    resolveRepoToken(source),
  );
  // A structural failure (bad content) demotes to trust 0. A TRANSIENT I/O
  // failure — the re-validation fetch could not complete (rate-limit / network,
  // common under a "Sync all" burst) — must NOT demote a repo whose sets just
  // downloaded fine: keep the existing trust so a blip is not a permanent
  // "Unverified" mark (#1441). A never-validated repo has no trust to keep → 0.
  const trust: TrustLevel = validation.ok
    ? 1
    : validation.transient
      ? (target.trust ?? 0)
      : 0;
  repos[index] = {
    ...target,
    connected: true,
    last_synced: new Date().toISOString(),
    set_count: manifestSets.length,
    lesson_count: lessonCount,
    trust,
  };
  await writeUserRepos(repos);
  return { setCount: manifestSets.length, lessonCount, trust };
}
