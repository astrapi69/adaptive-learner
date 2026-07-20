/**
 * Tests for the desktop GitHub-Releases update checker (#840).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { checkForUpdate, compareVersions } from "./updateChecker";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

describe("compareVersions", () => {
  it("orders versions and tolerates a leading v + missing patch", () => {
    expect(compareVersions("v1.89.0", "v1.90.0")).toBe(-1);
    expect(compareVersions("v2.0.0", "v1.99.0")).toBe(1);
    expect(compareVersions("1.89.0", "v1.89.0")).toBe(0);
    expect(compareVersions("2.0", "2.0.0")).toBe(0);
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
  });
});

describe("checkForUpdate (GitHub)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reports an available update with url + notes", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        tag_name: "v1.90.0",
        html_url: "https://github.com/astrapi69/adaptive-learner/releases/tag/v1.90.0",
        body: "## What's new\n- Stuff",
        published_at: "2026-06-20T00:00:00Z",
      }),
    );
    const result = await checkForUpdate("1.89.0", fetchImpl as unknown as typeof fetch);
    expect(result.status).toBe("update-available");
    expect(result.latestVersion).toBe("1.90.0");
    expect(result.releaseUrl).toContain("/releases/tag/v1.90.0");
    expect(result.releaseNotes).toContain("What's new");
  });

  it("reports up-to-date when the tag matches", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ tag_name: "v1.89.0" }));
    const result = await checkForUpdate("1.89.0", fetchImpl as unknown as typeof fetch);
    expect(result.status).toBe("up-to-date");
    expect(result.latestVersion).toBe("1.89.0");
  });

  it("reports up-to-date when the running build is newer (pre-release dev)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ tag_name: "v1.88.0" }));
    const result = await checkForUpdate("1.89.0", fetchImpl as unknown as typeof fetch);
    expect(result.status).toBe("up-to-date");
  });

  it("returns error on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false));
    const result = await checkForUpdate("1.89.0", fetchImpl as unknown as typeof fetch);
    expect(result.status).toBe("error");
  });

  it("returns error on a network failure (never throws)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    const result = await checkForUpdate("1.89.0", fetchImpl as unknown as typeof fetch);
    expect(result.status).toBe("error");
    expect(result.currentVersion).toBe("1.89.0");
  });

  it("returns error when the payload has no tag", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ html_url: "x" }));
    const result = await checkForUpdate("1.89.0", fetchImpl as unknown as typeof fetch);
    expect(result.status).toBe("error");
  });
});

describe("checkForUpdateUnified (mode dispatch)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("uses the service worker in Dexie mode (not GitHub)", async () => {
    vi.resetModules();
    vi.doMock("../../storage", () => ({ resolveStorageMode: () => "dexie" }));
    // #1873 — the service-worker check now comes from the kit.
    const swCheck = vi.fn(async () => ({
      status: "current",
      latestVersion: "1.89.0",
      latestHash: "x",
    }));
    vi.doMock("@astrapi69/pwa-update", () => ({
      checkForUpdateReliable: swCheck,
    }));
    vi.doMock("../pwa/update-store", () => ({
      CURRENT_BUILD: { version: "1.89.0", buildHash: "x" },
      versionJsonUrl: () => "/version.json",
    }));
    const fetchImpl = vi.fn();
    const { checkForUpdateUnified } = await import("./updateChecker");
    const result = await checkForUpdateUnified(fetchImpl as unknown as typeof fetch);
    expect(swCheck).toHaveBeenCalledOnce();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe("up-to-date");
  });

  it("uses the GitHub API in API mode (not the service worker)", async () => {
    vi.resetModules();
    vi.doMock("../../storage", () => ({ resolveStorageMode: () => "api" }));
    const swCheck = vi.fn();
    vi.doMock("@astrapi69/pwa-update", () => ({
      checkForUpdateReliable: swCheck,
    }));
    vi.doMock("../pwa/update-store", () => ({
      CURRENT_BUILD: { version: "1.89.0", buildHash: "x" },
      versionJsonUrl: () => "/version.json",
    }));
    const fetchImpl = vi.fn(async () => jsonResponse({ tag_name: "v1.90.0", html_url: "u" }));
    const { checkForUpdateUnified } = await import("./updateChecker");
    const result = await checkForUpdateUnified(fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(swCheck).not.toHaveBeenCalled();
    expect(result.status).toBe("update-available");
  });
});
