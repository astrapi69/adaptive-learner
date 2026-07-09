/**
 * GitHub PAT + community-PR namespace.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type { RegistryEntry } from "../../../lib/content/repos/registry-submission";


export interface GitHubTokenStatus {
  configured: boolean;
  source: string;
}

export type GitHubVerifyKind = "ok" | "invalid" | "rate_limit" | "network" | "error" | "no_token";

/** Result of verifying a GitHub token (``GET /user``). */
export interface GitHubVerifyResult {
  valid: boolean;
  username: string | null;
  kind: GitHubVerifyKind;
}

/** Best-effort manifest listing update passed with a PR request. */
export interface GitHubManifestUpdate {
  /** Repo-relative set directory, e.g. ``sets/de/es-a1``. */
  setPath: string;
  /** Lesson filename to append to ``metadata.lessons``. */
  lessonFilename: string;
}

/** Everything the fork -> branch -> commit -> PR flow needs. */
export interface CreateLessonPrArgs {
  /** ``owner/repo`` of the upstream content repo. */
  upstream: string;
  baseBranch: string;
  branchName: string;
  filePath: string;
  fileContent: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  manifestUpdate?: GitHubManifestUpdate | null;
}

export interface CreateLessonPrResult {
  url: string;
  number: number;
  manifestUpdated: boolean;
}

/**
 * GitHub integration for community PR automation. The app creates the
 * pull request PROGRAMMATICALLY (fork + commit + open PR) instead of
 * opening a pre-filled GitHub URL that frequently lost the content.
 *
 * Both modes: ApiStorage hits ``/api/github/*`` (the token stays
 * server-side in secrets.yaml); DexieStorage runs the flow
 * browser-direct via ``lib/github/github-api.ts`` with the token in
 * the browser (localStorage). A GitHub PAT (``repo`` scope) is not a
 * billable AI key, so browser storage is acceptable in Dexie mode.
 */
export interface IGitHubNamespace {
  getStatus(): Promise<GitHubTokenStatus>;
  setToken(token: string): Promise<GitHubTokenStatus>;
  clearToken(): Promise<GitHubTokenStatus>;
  /** Verify a token (or the configured one when omitted). Never throws
   *  — classifies the failure in ``kind``. */
  verifyToken(token?: string): Promise<GitHubVerifyResult>;
  /** Run the full PR flow. Throws ``ApiError`` on any GitHub failure. */
  createLessonPr(args: CreateLessonPrArgs): Promise<CreateLessonPrResult>;
  /** Export a set to a GitHub repository in the content-repo format
   *  (#1017): ensure the repo exists, then push all files in one commit.
   *  Throws ``ApiError`` on any GitHub failure. */
  exportSetToRepo(args: ExportSetToRepoArgs): Promise<ExportSetToRepoResult>;
  /** Propose a content repo for the federated search by opening a PR that
   *  adds its entry to the official registry (``recommended-repos.json``).
   *  Browser (Dexie) mode only for now; API mode throws a friendly 501.
   *  Throws ``ApiError`` on any GitHub failure. */
  createRegistryPr(
    args: CreateRegistryPrArgs,
  ): Promise<CreateRegistryPrResult>;
}

export interface CreateRegistryPrArgs {
  /** ``owner/repo`` of the official content repo hosting the registry. */
  upstream: string;
  /** Base branch to fork from + target with the PR (usually ``main``). */
  baseBranch: string;
  /** Unique branch name to create on the fork. */
  branchName: string;
  /** The registry file to edit, e.g. ``recommended-repos.json``. */
  registryFile: string;
  /** The registry entry to add / update. */
  entry: RegistryEntry;
  prTitle: string;
  prBody: string;
}

export interface CreateRegistryPrResult {
  url: string;
  number: number;
}

export interface ExportSetToRepoArgs {
  /** ``owner/repo`` of the target repository. */
  ownerRepo: string;
  /** ``true`` creates a private repo (when it doesn't exist yet). */
  private: boolean;
  /** Target branch (usually the repo's default, e.g. ``main``). */
  branch: string;
  /** Short repo description (used when creating the repo). */
  description?: string;
  /** The files to commit (content-repo format). */
  files: ReadonlyArray<{ path: string; content: string }>;
  /** The commit message. */
  message: string;
}

export interface ExportSetToRepoResult {
  /** ``owner/repo`` the set was exported to. */
  ownerRepo: string;
  /** Browser URL of the pushed commit. */
  commitUrl: string;
  /** Repo home URL (for the "open repository" link). */
  repoUrl: string;
}
