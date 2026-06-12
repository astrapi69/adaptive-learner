/**
 * GitHub PAT + community-PR namespace.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */


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
}
