import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import {
  GitHubApi,
  base64ToUtf8,
  githubErrorDetail,
  isValidGitHubTokenFormat,
  lessonBranchName,
  utf8ToBase64,
} from "./github-api";

/** Build a Response-like object for the scripted fake fetch. */
function mkResp(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as unknown as Response;
}

/** A fetch that dispatches on ``METHOD url-substring`` -> handler. */
function scriptedFetch(
  handlers: Record<string, (init: RequestInit) => Response>,
) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const impl = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({
      method,
      url,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    for (const key of Object.keys(handlers)) {
      const [m, fragment] = key.split(" ");
      if (m === method && url.includes(fragment)) return handlers[key](init);
    }
    throw new Error(`unscripted: ${method} ${url}`);
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const NOOP_SLEEP = () => Promise.resolve();

describe("token format validation", () => {
  it("accepts classic and fine-grained tokens", () => {
    expect(isValidGitHubTokenFormat("ghp_" + "a".repeat(36))).toBe(true);
    expect(isValidGitHubTokenFormat("github_pat_" + "b".repeat(40))).toBe(true);
  });
  it("rejects wrong prefix or too-short", () => {
    expect(isValidGitHubTokenFormat("sk-ant-123")).toBe(false);
    expect(isValidGitHubTokenFormat("ghp_short")).toBe(false);
    expect(isValidGitHubTokenFormat("")).toBe(false);
  });
});

describe("base64 round-trip (UTF-8 safe)", () => {
  it("preserves umlauts and emoji", () => {
    const text = 'Schöne Grüße — café ☕ {"k":"ü"}';
    expect(base64ToUtf8(utf8ToBase64(text))).toBe(text);
  });
  it("tolerates GitHub's newline-wrapped base64", () => {
    const b64 = utf8ToBase64("hello world");
    const wrapped = b64.slice(0, 4) + "\n" + b64.slice(4);
    expect(base64ToUtf8(wrapped)).toBe("hello world");
  });
});

describe("lessonBranchName", () => {
  it("slugifies and appends the date", () => {
    expect(lessonBranchName("Konjugation üben!", "2026-06-03")).toBe(
      "add-konjugation-ben-2026-06-03",
    );
  });
  it("falls back to 'lesson' for an empty slug", () => {
    expect(lessonBranchName("!!!", "2026-06-03")).toBe("add-lesson-2026-06-03");
  });
});

describe("githubErrorDetail", () => {
  it("extracts message + errors", () => {
    expect(githubErrorDetail({ message: "Bad", errors: [{ x: 1 }] })).toContain(
      "Bad",
    );
    expect(githubErrorDetail({ message: "Just msg" })).toBe("Just msg");
    expect(githubErrorDetail("oops")).toBe("unexpected error");
  });
});

describe("GitHubApi.verifyToken", () => {
  it("returns the username on 200", async () => {
    const { impl } = scriptedFetch({
      "GET /user": () => mkResp(200, { login: "octocat" }),
    });
    const api = new GitHubApi("ghp_x", { fetchImpl: impl });
    expect(await api.verifyToken()).toEqual({
      valid: true,
      username: "octocat",
      kind: "ok",
    });
  });

  it("classifies 401 as invalid", async () => {
    const { impl } = scriptedFetch({
      "GET /user": () => mkResp(401, { message: "Bad creds" }),
    });
    const api = new GitHubApi("ghp_bad", { fetchImpl: impl });
    expect((await api.verifyToken()).kind).toBe("invalid");
  });

  it("classifies a rate-limited 403", async () => {
    const { impl } = scriptedFetch({
      "GET /user": () => mkResp(403, { message: "rate" }, { "x-ratelimit-remaining": "0" }),
    });
    const api = new GitHubApi("ghp_x", { fetchImpl: impl });
    expect((await api.verifyToken()).kind).toBe("rate_limit");
  });

  it("returns no_token for an empty token", async () => {
    const api = new GitHubApi("");
    expect((await api.verifyToken()).kind).toBe("no_token");
  });

  it("returns network when fetch throws", async () => {
    const impl = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const api = new GitHubApi("ghp_x", { fetchImpl: impl });
    expect((await api.verifyToken()).kind).toBe("network");
  });
});

describe("GitHubApi default fetch is bound (no 'Illegal invocation')", () => {
  // Regression: storing a bare ``fetch`` as ``this.fetchImpl`` and calling it
  // as ``this.fetchImpl(...)`` invokes native fetch with the GitHubApi instance
  // as its receiver, which browsers reject with
  // "Failed to execute 'fetch' on 'Window': illegal invocation". The default
  // must be bound to globalThis. This is the bug behind the failing invite-code
  // "Code generieren" button.
  it("calls the global fetch without an Illegal-invocation error when no fetchImpl is injected", async () => {
    // A browser-style native fetch: rejects any receiver that is not the global
    // object, exactly like the real ``window.fetch``. With the pre-fix code
    // (``this.fetchImpl = fetch``) the method call ``this.fetchImpl(...)`` would
    // run this with the GitHubApi instance as receiver and throw.
    const calls: string[] = [];
    const nativeFetch = function (this: unknown, url: string) {
      if (this !== globalThis) {
        throw new TypeError(
          "Failed to execute 'fetch' on 'Window': Illegal invocation",
        );
      }
      calls.push(url);
      return Promise.resolve(mkResp(200, { login: "octocat" }));
    } as unknown as typeof fetch;
    vi.stubGlobal("fetch", nativeFetch);
    try {
      // No options -> falls back to the bound global fetch (the fix).
      const api = new GitHubApi("ghp_x");
      const result = await api.verifyToken();
      expect(result).toEqual({ valid: true, username: "octocat", kind: "ok" });
      expect(calls).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("GitHubApi.createLessonPr (full flow)", () => {
  function happyHandlers() {
    const manifest =
      "name: Set\nmetadata:\n  author: x\n  lessons:\n    - 01-intro.json\n";
    const state = { lessonCommits: 0, manifestCommits: 0 };
    const handlers: Record<string, (init: RequestInit) => Response> = {
      "POST /forks": () =>
        mkResp(202, {
          full_name: "octocat/content",
          owner: { login: "octocat" },
        }),
      "GET /git/ref/heads/main": () =>
        mkResp(200, { object: { sha: "basesha" } }),
      "POST /git/refs": () => mkResp(201, {}),
      "GET /contents/": () =>
        mkResp(200, {
          sha: "manifestsha",
          content: utf8ToBase64(manifest),
        }),
      "PUT /contents/": (init) => {
        const body = JSON.parse(init.body as string);
        if (body.message.includes("manifest")) state.manifestCommits += 1;
        else state.lessonCommits += 1;
        return mkResp(201, { content: { sha: "newsha" } });
      },
      "POST /pulls": () =>
        mkResp(201, {
          html_url: "https://github.com/up/content/pull/7",
          number: 7,
        }),
    };
    return { handlers, state };
  }

  it("forks, branches, commits, updates manifest, opens the PR", async () => {
    const { handlers, state } = happyHandlers();
    const { impl, calls } = scriptedFetch(handlers);
    const api = new GitHubApi("ghp_token", {
      fetchImpl: impl,
      sleep: NOOP_SLEEP,
    });
    const result = await api.createLessonPr({
      upstream: "up/content",
      baseBranch: "main",
      branchName: "add-intro-2026-06-03",
      filePath: "sets/de/es-a1/lessons/16-intro.json",
      fileContent: '{"id":"x"}',
      commitMessage: "content: Intro",
      prTitle: "content: Intro",
      prBody: "body",
      manifestUpdate: {
        setPath: "sets/de/es-a1",
        lessonFilename: "16-intro.json",
      },
    });
    expect(result).toEqual({
      url: "https://github.com/up/content/pull/7",
      number: 7,
      manifestUpdated: true,
    });
    expect(state.lessonCommits).toBe(1);
    expect(state.manifestCommits).toBe(1);
    // PR head is forkOwner:branch.
    const prCall = calls.find((c) => c.url.includes("/pulls"));
    expect((prCall?.body as { head: string }).head).toBe(
      "octocat:add-intro-2026-06-03",
    );
  });

  it("skips manifest update without a manifestUpdate arg", async () => {
    const { handlers, state } = happyHandlers();
    const { impl } = scriptedFetch(handlers);
    const api = new GitHubApi("ghp_token", {
      fetchImpl: impl,
      sleep: NOOP_SLEEP,
    });
    const result = await api.createLessonPr({
      upstream: "up/content",
      baseBranch: "main",
      branchName: "add-intro-2026-06-03",
      filePath: "sets/de/es-a1/lessons/16-intro.json",
      fileContent: '{"id":"x"}',
      commitMessage: "content: Intro",
      prTitle: "content: Intro",
      prBody: "body",
    });
    expect(result.manifestUpdated).toBe(false);
    expect(state.manifestCommits).toBe(0);
  });

  it("treats a missing manifest (new set) as non-fatal", async () => {
    const { handlers } = happyHandlers();
    handlers["GET /contents/"] = () => mkResp(404, { message: "Not Found" });
    const { impl } = scriptedFetch(handlers);
    const api = new GitHubApi("ghp_token", {
      fetchImpl: impl,
      sleep: NOOP_SLEEP,
    });
    const result = await api.createLessonPr({
      upstream: "up/content",
      baseBranch: "main",
      branchName: "add-intro-2026-06-03",
      filePath: "sets/de/es-a1/lessons/16-intro.json",
      fileContent: '{"id":"x"}',
      commitMessage: "content: Intro",
      prTitle: "content: Intro",
      prBody: "body",
      manifestUpdate: {
        setPath: "sets/de/es-a1",
        lessonFilename: "16-intro.json",
      },
    });
    expect(result.number).toBe(7);
    expect(result.manifestUpdated).toBe(false);
  });

  it("throws ApiError when the fork call fails", async () => {
    const { handlers } = happyHandlers();
    handlers["POST /forks"] = () => mkResp(403, { message: "no repo scope" });
    const { impl } = scriptedFetch(handlers);
    const api = new GitHubApi("ghp_token", {
      fetchImpl: impl,
      sleep: NOOP_SLEEP,
    });
    await expect(
      api.createLessonPr({
        upstream: "up/content",
        baseBranch: "main",
        branchName: "b",
        filePath: "p.json",
        fileContent: "{}",
        commitMessage: "m",
        prTitle: "t",
        prBody: "b",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("polls the fork ref until it is ready", async () => {
    const { handlers } = happyHandlers();
    let refCalls = 0;
    handlers["GET /git/ref/heads/main"] = () => {
      refCalls += 1;
      // First poll (after fork) 404s; the branch-create base-sha read
      // then succeeds. The poll uses the same endpoint, so 404 once.
      if (refCalls === 1) return mkResp(404, { message: "not ready" });
      return mkResp(200, { object: { sha: "basesha" } });
    };
    const { impl } = scriptedFetch(handlers);
    const api = new GitHubApi("ghp_token", {
      fetchImpl: impl,
      sleep: NOOP_SLEEP,
      forkPollIntervalMs: 1,
    });
    const result = await api.createLessonPr({
      upstream: "up/content",
      baseBranch: "main",
      branchName: "add-intro-2026-06-03",
      filePath: "sets/de/es-a1/lessons/16-intro.json",
      fileContent: '{"id":"x"}',
      commitMessage: "content: Intro",
      prTitle: "content: Intro",
      prBody: "body",
    });
    expect(result.number).toBe(7);
    expect(refCalls).toBeGreaterThanOrEqual(2);
  });
});

describe("GitHubApi.createRegistryPr (federated search)", () => {
  const ENTRY = {
    url: "https://github.com/jane/content",
    branch: "main",
    commit: "a".repeat(40),
    title: "Jane",
    trust_level: 1,
    languages: ["de-fr"],
    validation: { status: "validated" as const, validated_at: "2026-07-09T00:00:00Z" },
  };

  it("forks, branches, splices the entry into the existing registry, commits, opens the PR", async () => {
    const existing = JSON.stringify({
      repos: [{ url: "https://github.com/astrapi69/adaptive-learner-content", self: true }],
    });
    let committed: { path: string; content: string } | null = null;
    const handlers: Record<string, (init: RequestInit) => Response> = {
      "POST /forks": () =>
        mkResp(202, { full_name: "octocat/content", owner: { login: "octocat" } }),
      "GET /git/ref/heads/main": () => mkResp(200, { object: { sha: "basesha" } }),
      "POST /git/refs": () => mkResp(201, {}),
      "GET /contents/": () =>
        mkResp(200, { sha: "regsha", content: utf8ToBase64(existing) }),
      "PUT /contents/": (init) => {
        const body = JSON.parse(init.body as string);
        committed = { path: "recommended-repos.json", content: base64ToUtf8(body.content) };
        return mkResp(201, { content: { sha: "newsha" } });
      },
      "POST /pulls": () =>
        mkResp(201, {
          html_url: "https://github.com/astrapi69/adaptive-learner-content/pull/9",
          number: 9,
        }),
    };
    const { impl, calls } = scriptedFetch(handlers);
    const api = new GitHubApi("ghp_token", { fetchImpl: impl, sleep: NOOP_SLEEP });
    const result = await api.createRegistryPr({
      upstream: "astrapi69/adaptive-learner-content",
      baseBranch: "main",
      branchName: "register-jane-content-2026-07-09",
      registryFile: "recommended-repos.json",
      entry: ENTRY,
      prTitle: "registry: add jane/content",
      prBody: "body",
    });
    expect(result).toEqual({
      url: "https://github.com/astrapi69/adaptive-learner-content/pull/9",
      number: 9,
    });
    // The committed registry now carries BOTH the self entry and the new one.
    const parsed = JSON.parse(committed!.content);
    expect(parsed.repos).toHaveLength(2);
    expect(parsed.repos[1].url).toBe("https://github.com/jane/content");
    // PR head is forkOwner:branch upstream.
    const prCall = calls.find((c) => c.url.includes("/pulls"));
    expect((prCall?.body as { head: string }).head).toBe(
      "octocat:register-jane-content-2026-07-09",
    );
  });
});
