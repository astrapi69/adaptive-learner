import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above imports, so the shared spies must
// be created via vi.hoisted (also hoisted) to be referenceable inside.
const { mockApi, verifyTokenSpy, createLessonPrSpy } = vi.hoisted(() => ({
  mockApi: {
    github: {
      getStatus: vi.fn(),
      setToken: vi.fn(),
      clearToken: vi.fn(),
      verifyToken: vi.fn(),
      createPr: vi.fn(),
    },
  },
  verifyTokenSpy: vi.fn(async () => ({
    valid: true,
    username: "octocat",
    kind: "ok" as const,
  })),
  createLessonPrSpy: vi.fn(async () => ({
    url: "https://github.com/up/content/pull/9",
    number: 9,
    manifestUpdated: false,
  })),
}));

// --- ApiStorage: wire (snake_case) <-> namespace (camelCase) mapping --------

vi.mock("../api/client", () => ({
  api: mockApi,
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      detail: string,
    ) {
      super(detail);
    }
  },
}));

// --- DexieStorage: stub the browser-direct GitHub client --------------------

vi.mock("../lib/github/github-api", () => ({
  GitHubApi: class {
    constructor(public token: string) {}
    verifyToken = verifyTokenSpy;
    createLessonPr = createLessonPrSpy;
  },
}));

import { apiStorage } from "./api-storage";
import { dexieStorage } from "./dexie-storage";

describe("ApiStorage.github (proxy mapping)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createLessonPr maps camelCase args to the snake_case wire body", async () => {
    mockApi.github.createPr.mockResolvedValue({
      url: "https://x/pull/1",
      number: 1,
      manifest_updated: true,
    });
    const result = await apiStorage.github.createLessonPr({
      upstream: "up/content",
      baseBranch: "main",
      branchName: "add-x-2026-06-03",
      filePath: "sets/de/es-a1/lessons/16-x.json",
      fileContent: "{}",
      commitMessage: "content: X",
      prTitle: "content: X",
      prBody: "body",
      manifestUpdate: { setPath: "sets/de/es-a1", lessonFilename: "16-x.json" },
    });
    expect(mockApi.github.createPr).toHaveBeenCalledWith({
      upstream: "up/content",
      base_branch: "main",
      branch_name: "add-x-2026-06-03",
      file_path: "sets/de/es-a1/lessons/16-x.json",
      file_content: "{}",
      commit_message: "content: X",
      pr_title: "content: X",
      pr_body: "body",
      manifest_update: {
        set_path: "sets/de/es-a1",
        lesson_filename: "16-x.json",
      },
    });
    expect(result).toEqual({
      url: "https://x/pull/1",
      number: 1,
      manifestUpdated: true,
    });
  });

  it("passes a null manifest_update through when omitted", async () => {
    mockApi.github.createPr.mockResolvedValue({
      url: "u",
      number: 2,
      manifest_updated: false,
    });
    await apiStorage.github.createLessonPr({
      upstream: "up/content",
      baseBranch: "main",
      branchName: "b",
      filePath: "p.json",
      fileContent: "{}",
      commitMessage: "m",
      prTitle: "t",
      prBody: "b",
    });
    expect(mockApi.github.createPr.mock.calls[0][0].manifest_update).toBeNull();
  });
});

describe("DexieStorage.github (browser-direct + localStorage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  it("setToken / getStatus / clearToken round-trip via localStorage", async () => {
    expect(await dexieStorage.github.getStatus()).toEqual({
      configured: false,
      source: "none",
    });
    await dexieStorage.github.setToken("ghp_browser_token_123456");
    expect(await dexieStorage.github.getStatus()).toEqual({
      configured: true,
      source: "browser",
    });
    await dexieStorage.github.clearToken();
    expect(await dexieStorage.github.getStatus()).toEqual({
      configured: false,
      source: "none",
    });
  });

  it("verifyToken delegates to the browser-direct client", async () => {
    const result = await dexieStorage.github.verifyToken("ghp_x");
    expect(verifyTokenSpy).toHaveBeenCalled();
    expect(result.username).toBe("octocat");
  });

  it("createLessonPr requires a stored token", async () => {
    await expect(
      dexieStorage.github.createLessonPr({
        upstream: "up/content",
        baseBranch: "main",
        branchName: "b",
        filePath: "p.json",
        fileContent: "{}",
        commitMessage: "m",
        prTitle: "t",
        prBody: "b",
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(createLessonPrSpy).not.toHaveBeenCalled();
  });

  it("createLessonPr runs the flow when a token is stored", async () => {
    await dexieStorage.github.setToken("ghp_browser_token_123456");
    const result = await dexieStorage.github.createLessonPr({
      upstream: "up/content",
      baseBranch: "main",
      branchName: "b",
      filePath: "p.json",
      fileContent: "{}",
      commitMessage: "m",
      prTitle: "t",
      prBody: "b",
    });
    expect(createLessonPrSpy).toHaveBeenCalled();
    expect(result.number).toBe(9);
  });
});
