/**
 * Connect a public content repo by link (#3819).
 *
 * The one flow behind every "add this repo" action that comes from a link:
 * the ``/add-repo`` invite page and the short set link
 * (``/content/set/<id>``) for a set of a repo the learner has not added yet.
 * No token is involved; a private repo is added in Settings with its token.
 */

import { validateUserRepo, type RepoValidationResult } from "./content-repo-validate";
import {
  addUserRepo,
  parseGitHubRepoUrl,
  syncUserRepo,
  userRepoSource,
  type SyncProgress,
} from "./content-repos";

/** The repo to connect, as a link names it. */
export interface ConnectRepoInput {
  /** ``owner/repo`` or a GitHub URL; stored as entered, for display. */
  url: string;
  branch: string;
}

/** Outcome of {@link connectPublicRepo}. */
export type ConnectRepoResult =
  | { ok: true; source: string }
  | { ok: false; validation: RepoValidationResult };

/**
 * Validate the repo, add it to the learner's repo list and sync it.
 *
 * A failed validation stores nothing and is returned for the caller to show.
 * Errors of the store or the sync propagate.
 *
 * @throws Error when ``url`` names no GitHub repository.
 * @example
 * const result = await connectPublicRepo({ url: "jane/deck", branch: "main" }, setProgress);
 * if (!result.ok) showReason(result.validation);
 */
export async function connectPublicRepo(
  input: ConnectRepoInput,
  onProgress?: (progress: SyncProgress) => void,
): Promise<ConnectRepoResult> {
  const parsed = parseGitHubRepoUrl(input.url);
  if (!parsed) throw new Error(`"${input.url}" is not a GitHub repository.`);
  const validation = await validateUserRepo({ ...parsed, branch: input.branch });
  if (!validation.ok) return { ok: false, validation };
  await addUserRepo({
    url: input.url,
    owner: parsed.owner,
    repo: parsed.repo,
    branch: input.branch,
    connected: true,
    last_synced: null,
    set_count: validation.setCount,
    lesson_count: validation.lessonCount,
    trust: 1,
  });
  const source = userRepoSource(parsed.owner, parsed.repo);
  await syncUserRepo(source, onProgress);
  return { ok: true, source };
}
