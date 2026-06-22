/**
 * Browser-direct GitHub REST client for community PR automation
 * (Dexie / GitHub-Pages mode).
 *
 * Replaces the pre-filled-URL share approach (URL-length limits +
 * browser differences left users with empty PRs) with a real,
 * token-authenticated flow that COMMITS the lesson file and opens the
 * pull request:
 *
 *   1. verify the token / resolve the authenticated username
 *   2. fork the upstream content repo (idempotent — reuses an existing
 *      fork)
 *   3. create a branch on the fork from its base-branch HEAD
 *   4. commit the lesson JSON at the correct tree path
 *   5. best-effort: append the lesson filename to the set manifest's
 *      ``metadata.lessons`` list (skipped on any failure)
 *   6. open the pull request fork -> upstream
 *
 * GitHub's API allows cross-origin requests with the token in the
 * Authorization header, so this works directly from the browser with
 * no backend. The API-mode equivalent (token kept server-side) lives
 * in ``backend/app/services/github_service.py``.
 *
 * The class takes an injectable ``fetchImpl`` + ``sleep`` so the flow
 * is unit-testable with a scripted fake (no real network, no timers).
 * Failures throw :class:`ApiError` so the existing friendly-error
 * mapper + ShareWizard classifier handle them uniformly.
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { ApiError } from "../../api/client";

const GITHUB_API_BASE = "https://api.github.com";

/** A GitHub PAT: classic ``ghp_…`` or fine-grained ``github_pat_…``.
 *  Lenient on the exact length (GitHub has changed it); the prefix +
 *  a sane minimum length is enough to catch typos / pasted junk. */
export function isValidGitHubTokenFormat(token: string): boolean {
  const trimmed = token.trim();
  if (trimmed.length < 20) return false;
  return trimmed.startsWith("ghp_") || trimmed.startsWith("github_pat_");
}

/** Stable machine codes the UI maps to a localized message (mirrors
 *  the AI-key test result). */
export type GitHubVerifyKind =
  | "ok"
  | "invalid"
  | "rate_limit"
  | "network"
  | "error"
  | "no_token";

export interface GitHubVerifyResult {
  valid: boolean;
  username: string | null;
  kind: GitHubVerifyKind;
}

/** Best-effort manifest patch passed alongside a PR request. */
export interface ManifestUpdate {
  /** Repo-relative set directory, e.g. ``sets/de/es-a1``. */
  setPath: string;
  /** The lesson filename to add, e.g. ``16-konjugation.json``. */
  lessonFilename: string;
}

export interface CreateLessonPrArgs {
  /** ``owner/repo`` of the upstream content repo. */
  upstream: string;
  /** Base branch to fork from + target with the PR (usually ``main``). */
  baseBranch: string;
  /** Unique branch name to create on the fork. */
  branchName: string;
  /** Repo-relative file path the lesson lands at. */
  filePath: string;
  /** The lesson JSON (committed verbatim). */
  fileContent: string;
  /** Commit message for the lesson file. */
  commitMessage: string;
  prTitle: string;
  prBody: string;
  /** Optional best-effort manifest listing update. */
  manifestUpdate?: ManifestUpdate | null;
}

export interface CreateLessonPrResult {
  url: string;
  number: number;
  manifestUpdated: boolean;
}

export interface GitHubApiOptions {
  fetchImpl?: typeof fetch;
  /** Injectable delay (tests pass a no-op to avoid real timers). */
  sleep?: (ms: number) => Promise<void>;
  /** Max poll attempts while waiting for an async fork to provision. */
  forkPollAttempts?: number;
  forkPollIntervalMs?: number;
}

/** UTF-8 safe base64 (GitHub's contents API wants base64 content). */
export function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Inverse of {@link utf8ToBase64}. */
export function base64ToUtf8(b64: string): string {
  // GitHub returns base64 with embedded newlines; strip whitespace.
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

interface GhResponse<T> {
  status: number;
  ok: boolean;
  headers: Headers;
  body: T;
}

/**
 * Browser-direct GitHub REST client used in Dexie mode to fork a repo, commit
 * a lesson, and open a pull request without a backend. Retries and fork-poll
 * behaviour are configurable for testing.
 */
export class GitHubApi {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly forkPollAttempts: number;
  private readonly forkPollIntervalMs: number;

  constructor(
    private readonly token: string,
    options: GitHubApiOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep =
      options.sleep ?? ((ms) => new Promise((res) => setTimeout(res, ms)));
    this.forkPollAttempts = options.forkPollAttempts ?? 10;
    this.forkPollIntervalMs = options.forkPollIntervalMs ?? 2000;
  }

  /** Low-level request returning status + parsed body (never throws on
   *  a non-2xx; callers decide what's acceptable). */
  private async call<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<GhResponse<T>> {
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const resp = await this.fetchImpl(`${GITHUB_API_BASE}${path}`, init);
    let parsed: unknown;
    try {
      parsed = await resp.json();
    } catch {
      parsed = null;
    }
    return {
      status: resp.status,
      ok: resp.ok,
      headers: resp.headers,
      body: parsed as T,
    };
  }

  /** Request that throws {@link ApiError} on an unexpected status. */
  private async require<T>(
    method: string,
    path: string,
    body: unknown | undefined,
    okStatuses: number[],
  ): Promise<GhResponse<T>> {
    const resp = await this.call<T>(method, path, body);
    if (!okStatuses.includes(resp.status)) {
      const detail = githubErrorDetail(resp.body);
      throw new ApiError(
        resp.status,
        `GitHub ${method} ${path}: ${detail}`,
        path,
        method,
      );
    }
    return resp;
  }

  /** Verify the token and return the authenticated username. Never
   *  throws — classifies the failure instead. */
  async verifyToken(): Promise<GitHubVerifyResult> {
    if (!this.token || !this.token.trim()) {
      return { valid: false, username: null, kind: "no_token" };
    }
    let resp: GhResponse<{ login?: string }>;
    try {
      resp = await this.call<{ login?: string }>("GET", "/user");
    } catch {
      return { valid: false, username: null, kind: "network" };
    }
    if (resp.ok) {
      return { valid: true, username: resp.body?.login ?? null, kind: "ok" };
    }
    if (
      resp.status === 403 &&
      resp.headers.get("x-ratelimit-remaining") === "0"
    ) {
      return { valid: false, username: null, kind: "rate_limit" };
    }
    if (resp.status === 401 || resp.status === 403) {
      return { valid: false, username: null, kind: "invalid" };
    }
    if (resp.status === 429) {
      return { valid: false, username: null, kind: "rate_limit" };
    }
    return { valid: false, username: null, kind: "error" };
  }

  /** Fork the upstream repo (idempotent) and wait until the fork's base
   *  ref is readable. Returns ``{forkFullName, forkOwner}``. */
  private async ensureFork(
    upstream: string,
    baseBranch: string,
  ): Promise<{ forkFullName: string; forkOwner: string }> {
    const resp = await this.require<{
      full_name: string;
      owner: { login: string };
    }>("POST", `/repos/${upstream}/forks`, {}, [200, 201, 202]);
    const forkFullName = resp.body.full_name;
    const forkOwner = resp.body.owner.login;
    for (let attempt = 0; attempt < this.forkPollAttempts; attempt += 1) {
      const ref = await this.call(
        "GET",
        `/repos/${forkFullName}/git/ref/heads/${baseBranch}`,
      );
      if (ref.ok) return { forkFullName, forkOwner };
      await this.sleep(this.forkPollIntervalMs);
    }
    throw new ApiError(
      504,
      `GitHub fork ${forkFullName} not ready after polling`,
      "/forks",
      "POST",
    );
  }

  private async baseSha(fork: string, baseBranch: string): Promise<string> {
    const resp = await this.require<{ object: { sha: string } }>(
      "GET",
      `/repos/${fork}/git/ref/heads/${baseBranch}`,
      undefined,
      [200],
    );
    return resp.body.object.sha;
  }

  private async createBranch(
    fork: string,
    branch: string,
    fromSha: string,
  ): Promise<void> {
    await this.require(
      "POST",
      `/repos/${fork}/git/refs`,
      { ref: `refs/heads/${branch}`, sha: fromSha },
      [200, 201],
    );
  }

  private async commitFile(
    fork: string,
    branch: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
  ): Promise<void> {
    const body: Record<string, unknown> = {
      message,
      content: utf8ToBase64(content),
      branch,
    };
    if (sha) body.sha = sha;
    await this.require(
      "PUT",
      `/repos/${fork}/contents/${path}`,
      body,
      [200, 201],
    );
  }

  /** Best-effort: append the lesson filename to the set manifest's
   *  ``metadata.lessons``. Returns true only when the manifest existed
   *  and was updated. Never throws. */
  private async tryUpdateManifest(
    fork: string,
    branch: string,
    update: ManifestUpdate,
  ): Promise<boolean> {
    const manifestPath = `${update.setPath.replace(/\/$/, "")}/manifest.yaml`;
    try {
      const resp = await this.call<{ sha?: string; content?: string }>(
        "GET",
        `/repos/${fork}/contents/${encodeURI(manifestPath)}?ref=${branch}`,
      );
      if (!resp.ok || !resp.body?.content) return false;
      const raw = base64ToUtf8(resp.body.content);
      const manifest = parseYaml(raw);
      if (!manifest || typeof manifest !== "object") return false;
      const root = manifest as Record<string, unknown>;
      const metadata =
        root.metadata && typeof root.metadata === "object"
          ? (root.metadata as Record<string, unknown>)
          : {};
      const lessons = Array.isArray(metadata.lessons)
        ? (metadata.lessons as string[])
        : [];
      if (lessons.includes(update.lessonFilename)) return false;
      lessons.push(update.lessonFilename);
      metadata.lessons = lessons;
      root.metadata = metadata;
      await this.commitFile(
        fork,
        branch,
        manifestPath,
        stringifyYaml(root),
        `content: list ${update.lessonFilename} in manifest`,
        resp.body.sha,
      );
      return true;
    } catch {
      // A missing manifest (new set) or any error: the maintainer / CI
      // handles the listing instead. Never block the PR.
      return false;
    }
  }

  private async createPullRequest(
    upstream: string,
    head: string,
    baseBranch: string,
    title: string,
    body: string,
  ): Promise<{ url: string; number: number }> {
    const resp = await this.require<{ html_url: string; number: number }>(
      "POST",
      `/repos/${upstream}/pulls`,
      { title, body, head, base: baseBranch },
      [200, 201],
    );
    return { url: resp.body.html_url, number: resp.body.number };
  }

  /** Run the full fork -> branch -> commit -> (manifest) -> PR flow. */
  async createLessonPr(
    args: CreateLessonPrArgs,
  ): Promise<CreateLessonPrResult> {
    const { forkFullName, forkOwner } = await this.ensureFork(
      args.upstream,
      args.baseBranch,
    );
    const sha = await this.baseSha(forkFullName, args.baseBranch);
    await this.createBranch(forkFullName, args.branchName, sha);
    await this.commitFile(
      forkFullName,
      args.branchName,
      args.filePath,
      args.fileContent,
      args.commitMessage,
    );
    let manifestUpdated = false;
    if (args.manifestUpdate) {
      manifestUpdated = await this.tryUpdateManifest(
        forkFullName,
        args.branchName,
        args.manifestUpdate,
      );
    }
    const pr = await this.createPullRequest(
      args.upstream,
      `${forkOwner}:${args.branchName}`,
      args.baseBranch,
      args.prTitle,
      args.prBody,
    );
    return { url: pr.url, number: pr.number, manifestUpdated };
  }

  // --- Repository export (#1017) -----------------------------------------

  /** The authenticated user's login, or throws ApiError. */
  async getUsername(): Promise<string> {
    const resp = await this.require<{ login: string }>(
      "GET",
      "/user",
      undefined,
      [200],
    );
    return resp.body.login;
  }

  /** Ensure ``owner/repo`` exists, creating it (with an initial commit so
   *  it has a base ref) when missing. Returns the default branch. */
  async ensureRepo(
    ownerRepo: string,
    options: { private: boolean; description?: string },
  ): Promise<{ defaultBranch: string }> {
    const existing = await this.call<{ default_branch?: string }>(
      "GET",
      `/repos/${ownerRepo}`,
    );
    if (existing.ok) {
      return { defaultBranch: existing.body?.default_branch || "main" };
    }
    if (existing.status !== 404) {
      throw new ApiError(
        existing.status,
        `GitHub GET /repos/${ownerRepo}: ${githubErrorDetail(existing.body)}`,
        `/repos/${ownerRepo}`,
        "GET",
      );
    }
    const name = ownerRepo.split("/").slice(-1)[0];
    const created = await this.require<{ default_branch?: string }>(
      "POST",
      "/user/repos",
      {
        name,
        private: options.private,
        description: options.description ?? "",
        auto_init: true,
      },
      [200, 201],
    );
    return { defaultBranch: created.body?.default_branch || "main" };
  }

  /** Push ``files`` to ``ownerRepo``@``branch`` in a SINGLE commit via the
   *  Git Data API (blobs -> tree -> commit -> ref). Far fewer API calls
   *  than the per-file Contents API. Returns the commit's html url. */
  async pushFiles(
    ownerRepo: string,
    branch: string,
    files: ReadonlyArray<{ path: string; content: string }>,
    message: string,
  ): Promise<{ commitUrl: string }> {
    const baseSha = await this.baseSha(ownerRepo, branch);
    const baseCommit = await this.require<{ tree: { sha: string } }>(
      "GET",
      `/repos/${ownerRepo}/git/commits/${baseSha}`,
      undefined,
      [200],
    );
    const blobs = await Promise.all(
      files.map(async (file) => {
        const blob = await this.require<{ sha: string }>(
          "POST",
          `/repos/${ownerRepo}/git/blobs`,
          { content: utf8ToBase64(file.content), encoding: "base64" },
          [200, 201],
        );
        return { path: file.path, sha: blob.body.sha };
      }),
    );
    const tree = await this.require<{ sha: string }>(
      "POST",
      `/repos/${ownerRepo}/git/trees`,
      {
        base_tree: baseCommit.body.tree.sha,
        tree: blobs.map((b) => ({
          path: b.path,
          mode: "100644",
          type: "blob",
          sha: b.sha,
        })),
      },
      [200, 201],
    );
    const commit = await this.require<{ sha: string; html_url: string }>(
      "POST",
      `/repos/${ownerRepo}/git/commits`,
      { message, tree: tree.body.sha, parents: [baseSha] },
      [200, 201],
    );
    await this.require(
      "PATCH",
      `/repos/${ownerRepo}/git/refs/heads/${branch}`,
      { sha: commit.body.sha, force: false },
      [200],
    );
    return { commitUrl: commit.body.html_url };
  }
}

/** Pull a human-readable detail out of a GitHub error body. */
export function githubErrorDetail(body: unknown): string {
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const message = typeof obj.message === "string" ? obj.message : "";
    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      return `${message} (${JSON.stringify(obj.errors)})`;
    }
    if (message) return message;
  }
  return "unexpected error";
}

/** Build a unique-ish branch name for a lesson contribution:
 *  ``add-{slug}-{date}`` (date is ``YYYY-MM-DD``). The date keeps
 *  re-shares of the same lesson from colliding on the same branch. */
export function lessonBranchName(slug: string, date: string): string {
  const cleanSlug =
    slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "lesson";
  return `add-${cleanSlug}-${date}`;
}
