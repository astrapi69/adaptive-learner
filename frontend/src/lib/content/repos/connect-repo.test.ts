/**
 * Tests for connecting a public repo by link (#3819), the flow the
 * ``/add-repo`` page and the short set link share.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { addUserRepo, syncUserRepo, validateUserRepo } = vi.hoisted(() => ({
  addUserRepo: vi.fn(),
  syncUserRepo: vi.fn(),
  validateUserRepo: vi.fn(),
}));
vi.mock("./content-repos", async (orig) => ({
  ...(await orig<typeof import("./content-repos")>()),
  addUserRepo,
  syncUserRepo,
}));
vi.mock("./content-repo-validate", async (orig) => ({
  ...(await orig<typeof import("./content-repo-validate")>()),
  validateUserRepo,
}));

import { connectPublicRepo } from "./connect-repo";

beforeEach(() => {
  vi.clearAllMocks();
  addUserRepo.mockResolvedValue([]);
  syncUserRepo.mockResolvedValue({ setCount: 2, lessonCount: 9 });
  validateUserRepo.mockResolvedValue({ ok: true, setCount: 2, lessonCount: 9 });
});

describe("connectPublicRepo", () => {
  it("validates, stores and syncs the repo, then names its source", async () => {
    const onProgress = vi.fn();
    const result = await connectPublicRepo(
      { url: "https://github.com/astrapi69/alc-ai", branch: "main" },
      onProgress,
    );
    expect(result).toEqual({ ok: true, source: "astrapi69/alc-ai" });
    expect(validateUserRepo).toHaveBeenCalledWith({
      owner: "astrapi69",
      repo: "alc-ai",
      branch: "main",
    });
    expect(addUserRepo).toHaveBeenCalledWith({
      url: "https://github.com/astrapi69/alc-ai",
      owner: "astrapi69",
      repo: "alc-ai",
      branch: "main",
      connected: true,
      last_synced: null,
      set_count: 2,
      lesson_count: 9,
      trust: 1,
    });
    expect(syncUserRepo).toHaveBeenCalledWith("astrapi69/alc-ai", onProgress);
  });

  it("reports the validation and stores nothing when the repo fails validation", async () => {
    const validation = { ok: false, setCount: 0, lessonCount: 0, reasonCode: "no_sets" };
    validateUserRepo.mockResolvedValue(validation);
    const result = await connectPublicRepo({ url: "jane/deck", branch: "main" });
    expect(result).toEqual({ ok: false, validation });
    expect(addUserRepo).not.toHaveBeenCalled();
    expect(syncUserRepo).not.toHaveBeenCalled();
  });

  it.each([["an empty url", ""], ["a url without a repo", "not-a-repo"]])(
    "rejects %s without validating",
    async (_label, url) => {
      await expect(connectPublicRepo({ url, branch: "main" })).rejects.toThrow(
        /not a GitHub repository/,
      );
      expect(validateUserRepo).not.toHaveBeenCalled();
    },
  );
});
