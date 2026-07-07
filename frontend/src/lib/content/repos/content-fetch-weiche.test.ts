/**
 * Public-vs-private content-fetch weiche (#1429).
 *
 * The bug: the shared GitHub PAT bled onto the OFFICIAL public content repo
 * via {@link resolveRepoToken}, forcing its manifest + lessons onto the
 * ``api.github.com`` contents endpoint (60/h unauthenticated → 401/403, or
 * 401 on an expired PAT) instead of the ungedrosselt ``raw`` host.
 *
 * These tests pin the composed seam ``resolveRepoToken`` →
 * {@link buildFileRequest} / {@link fetchGitHubFileText}:
 *  - the official/public source is read from ``raw`` even with a shared PAT set
 *    (manifest + lesson), and no ``contents`` API call is made;
 *  - the raw body is returned verbatim — no base64 decode stage;
 *  - a genuinely private repo (its own per-repo token) still uses the
 *    authenticated ``contents`` API.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildFileRequest,
  fetchGitHubFileText,
} from "./github-fetch";
import { resolveRepoToken, writeRepoToken } from "./repo-token";
import { OFFICIAL_SOURCE } from "./source-identity";

const store = new Map<string, string>();
const SHARED_KEY = "adaptive-learner.github_token";

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function textRes(status: number, body = ""): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  } as Response;
}

describe("official/public source → raw, never the contents API (#1429)", () => {
  it("manifest.yaml resolves to a raw URL with no headers, even with a shared PAT", () => {
    store.set(SHARED_KEY, "ghp_shared");
    const token = resolveRepoToken(OFFICIAL_SOURCE);
    const { url, init } = buildFileRequest(
      OFFICIAL_SOURCE,
      "main",
      "manifest.yaml",
      token,
    );
    expect(url).toBe(
      "https://raw.githubusercontent.com/astrapi69/adaptive-learner-content/main/manifest.yaml",
    );
    expect(url).not.toContain("api.github.com");
    // No custom headers → simple cross-origin GET → no CORS preflight.
    expect(init).toBeUndefined();
  });

  it("a lesson JSON also resolves to raw for the public source", () => {
    store.set(SHARED_KEY, "ghp_shared");
    const token = resolveRepoToken(OFFICIAL_SOURCE);
    const { url } = buildFileRequest(
      OFFICIAL_SOURCE,
      "main",
      "sets/de/fr-a1/lessons/01-greetings.json",
      token,
    );
    expect(url).toBe(
      "https://raw.githubusercontent.com/astrapi69/adaptive-learner-content/main/sets/de/fr-a1/lessons/01-greetings.json",
    );
    expect(url).not.toContain("api.github.com");
  });

  it("fetches the manifest from raw and never calls the contents API", async () => {
    store.set(SHARED_KEY, "ghp_shared");
    const fetchMock = vi.fn().mockResolvedValue(textRes(200, "schema_version: 1"));
    vi.stubGlobal("fetch", fetchMock);

    const token = resolveRepoToken(OFFICIAL_SOURCE);
    await fetchGitHubFileText(OFFICIAL_SOURCE, "main", "manifest.yaml", token);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("raw.githubusercontent.com");
    expect(calledUrl).not.toContain("api.github.com");
    // No init object at all on the public path (no Authorization / Accept).
    expect(fetchMock.mock.calls[0][1]).toBeUndefined();
  });

  it("returns the raw body verbatim — no base64 decode stage", async () => {
    const rawJson = '{"schema_version":"1.4","sets":[{"id":"fr-a1"}]}';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textRes(200, rawJson)));

    const token = resolveRepoToken(OFFICIAL_SOURCE);
    const body = await fetchGitHubFileText(
      OFFICIAL_SOURCE,
      "main",
      "manifest.json",
      token,
    );
    // Body is the raw text, directly JSON-parseable (not a base64 envelope).
    expect(body).toBe(rawJson);
    expect(JSON.parse(body).sets[0].id).toBe("fr-a1");
  });
});

describe("private/coach repo → authenticated contents API (weiche)", () => {
  it("a per-repo token routes a user repo to api.github.com with Authorization", () => {
    writeRepoToken("coach/private-content", "ghp_coach");
    const token = resolveRepoToken("coach/private-content");
    const { url, init } = buildFileRequest(
      "coach/private-content",
      "main",
      "manifest.yaml",
      token,
    );
    expect(url).toBe(
      "https://api.github.com/repos/coach/private-content/contents/manifest.yaml?ref=main",
    );
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghp_coach");
    // vnd.github.raw returns the file bytes verbatim — no base64 JSON envelope.
    expect(headers.Accept).toBe("application/vnd.github.raw");
  });
});
