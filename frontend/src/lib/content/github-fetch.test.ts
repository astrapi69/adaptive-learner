/**
 * Tests for the CORS-safe GitHub content fetcher (#645).
 *
 * Covers host selection by auth (bug 1 — no token → raw with no headers;
 * token → api.github.com with Authorization) and the retry policy (bug 3 —
 * retry only transient 5xx, never CORS/network/4xx/404).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildFileRequest,
  fetchGitHubFileText,
  fetchWithRetry,
  isTransientStatus,
} from "./github-fetch";

function res(status: number, body = ""): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("buildFileRequest — host selection (bug 1)", () => {
  it("uses raw.githubusercontent.com with NO custom headers when no token", () => {
    const { url, init } = buildFileRequest("jane/content", "main", "manifest.yaml", "");
    expect(url).toBe(
      "https://raw.githubusercontent.com/jane/content/main/manifest.yaml",
    );
    // No headers → a "simple" cross-origin GET → no CORS preflight.
    expect(init).toBeUndefined();
  });

  it("trims leading slashes from the path", () => {
    const { url } = buildFileRequest("jane/content", "main", "/sets/a/01.json", "");
    expect(url).toBe(
      "https://raw.githubusercontent.com/jane/content/main/sets/a/01.json",
    );
  });

  it("uses api.github.com + Authorization + raw Accept when a token is given", () => {
    const { url, init } = buildFileRequest(
      "jane/private",
      "main",
      "sets/a/manifest.yaml",
      "ghp_secret",
    );
    expect(url).toBe(
      "https://api.github.com/repos/jane/private/contents/sets/a/manifest.yaml?ref=main",
    );
    expect(init?.headers).toEqual({
      Authorization: "Bearer ghp_secret",
      Accept: "application/vnd.github.raw",
    });
  });

  it("treats a whitespace-only token as no token (raw host)", () => {
    const { url, init } = buildFileRequest("jane/c", "main", "x.yaml", "   ");
    expect(url).toContain("raw.githubusercontent.com");
    expect(init).toBeUndefined();
  });
});

describe("isTransientStatus", () => {
  it("is true for 5xx only", () => {
    expect(isTransientStatus(500)).toBe(true);
    expect(isTransientStatus(503)).toBe(true);
    expect(isTransientStatus(404)).toBe(false);
    expect(isTransientStatus(403)).toBe(false);
    expect(isTransientStatus(200)).toBe(false);
  });
});

describe("fetchWithRetry — retry policy (bug 3)", () => {
  it("does NOT retry a rejected fetch (CORS / network TypeError)", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchWithRetry("https://x/y", undefined, { baseDelayMs: 0 }),
    ).rejects.toThrow(/Failed to fetch/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a 404", async () => {
    const fetchMock = vi.fn(async () => res(404));
    vi.stubGlobal("fetch", fetchMock);
    const response = await fetchWithRetry("https://x/y", undefined, {
      baseDelayMs: 0,
    });
    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a 4xx", async () => {
    const fetchMock = vi.fn(async () => res(403));
    vi.stubGlobal("fetch", fetchMock);
    await fetchWithRetry("https://x/y", undefined, { baseDelayMs: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a transient 5xx up to the cap, then returns the last response", async () => {
    const fetchMock = vi.fn(async () => res(503));
    vi.stubGlobal("fetch", fetchMock);
    const response = await fetchWithRetry("https://x/y", undefined, {
      retries: 3,
      baseDelayMs: 0,
    });
    expect(response.status).toBe(503);
    // 1 initial + 3 retries.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("stops retrying as soon as a 5xx recovers to 200", async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => (++call < 2 ? res(500) : res(200, "ok")));
    vi.stubGlobal("fetch", fetchMock);
    const response = await fetchWithRetry("https://x/y", undefined, {
      baseDelayMs: 0,
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fetchGitHubFileText", () => {
  it("returns the body on a 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res(200, "hello")),
    );
    await expect(fetchGitHubFileText("a/b", "main", "f.txt")).resolves.toBe(
      "hello",
    );
  });

  it("throws an error carrying the status on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res(404)),
    );
    await expect(
      fetchGitHubFileText("a/b", "main", "f.txt"),
    ).rejects.toMatchObject({ status: 404 });
  });
});
