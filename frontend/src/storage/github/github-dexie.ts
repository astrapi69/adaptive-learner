/**
 * Dexie-mode GitHub namespace (#1786 — extracted from
 * dexie-storage.ts).
 *
 * GitHub community-PR automation, browser-direct. The PAT lives in
 * localStorage (``GITHUB_TOKEN_KEY``) — a repo-scope PAT is not a
 * billable AI key, so browser storage is acceptable here. The fork
 * -> branch -> commit -> PR flow runs against api.github.com directly
 * (GitHub allows the cross-origin request with the Authorization
 * header). Failures throw ApiError so the friendly-error mapper +
 * ShareWizard classifier handle them identically to API mode.
 */

import { ApiError } from "../../api/client";
import type { IStorageService } from "../types";

/** localStorage key holding the GitHub PAT in Dexie (GH-Pages) mode. */
const GITHUB_TOKEN_KEY = "adaptive-learner.github_token";

/** Read the stored GitHub token (empty string when none / no storage). */
function readGitHubToken(): string {
  try {
    return localStorage.getItem(GITHUB_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Store (or clear, when blank) the GitHub token. */
function writeGitHubToken(token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) localStorage.setItem(GITHUB_TOKEN_KEY, trimmed);
    else localStorage.removeItem(GITHUB_TOKEN_KEY);
  } catch {
    /* storage unavailable — best effort */
  }
}

export const dexieGithub: IStorageService["github"] = {
  getStatus: async () => {
    const token = readGitHubToken();
    return {
      configured: token.length > 0,
      source: token.length > 0 ? "browser" : "none",
    };
  },
  setToken: async (token: string) => {
    writeGitHubToken(token);
    return { configured: token.trim().length > 0, source: "browser" };
  },
  clearToken: async () => {
    writeGitHubToken("");
    return { configured: false, source: "none" };
  },
  verifyToken: async (token?: string) => {
    const effective = (token ?? readGitHubToken()).trim();
    const { GitHubApi } = await import("../../lib/github/github-api");
    return new GitHubApi(effective).verifyToken();
  },
  createLessonPr: async (args) => {
    const token = readGitHubToken().trim();
    if (!token) {
      throw new ApiError(401, "No GitHub token configured.");
    }
    const { GitHubApi } = await import("../../lib/github/github-api");
    return new GitHubApi(token).createLessonPr(args);
  },
  exportSetToRepo: async (args) => {
    const token = readGitHubToken().trim();
    if (!token) {
      throw new ApiError(401, "No GitHub token configured.");
    }
    const { GitHubApi } = await import("../../lib/github/github-api");
    const api = new GitHubApi(token);
    const { defaultBranch } = await api.ensureRepo(args.ownerRepo, {
      private: args.private,
      description: args.description,
    });
    const branch = args.branch || defaultBranch;
    const { commitUrl } = await api.pushFiles(
      args.ownerRepo,
      branch,
      args.files,
      args.message,
    );
    return {
      ownerRepo: args.ownerRepo,
      commitUrl,
      repoUrl: `https://github.com/${args.ownerRepo}`,
    };
  },
  createRegistryPr: async (args) => {
    const token = readGitHubToken().trim();
    if (!token) {
      throw new ApiError(401, "No GitHub token configured.");
    }
    const { GitHubApi } = await import("../../lib/github/github-api");
    return new GitHubApi(token).createRegistryPr(args);
  },
};
