/**
 * Tests for the pure PWA version-check helpers (#613).
 */

import { describe, expect, it, vi } from "vitest";

import {
  fetchLatestVersion,
  isUpdateAvailable,
  parseVersionManifest,
} from "./version-check";

const cur = { version: "1.81.0", buildHash: "abc" };

describe("isUpdateAvailable", () => {
  it("flags a newer version", () => {
    expect(isUpdateAvailable(cur, { version: "1.82.0", buildHash: "x" })).toBe(
      true,
    );
  });

  it("flags a same-version new build hash (both known)", () => {
    expect(
      isUpdateAvailable(cur, { version: "1.81.0", buildHash: "def" }),
    ).toBe(true);
  });

  it("does not flag an identical manifest", () => {
    expect(isUpdateAvailable(cur, { version: "1.81.0", buildHash: "abc" })).toBe(
      false,
    );
  });

  it("does not flag when only the hash differs but one side is unknown", () => {
    expect(
      isUpdateAvailable(cur, { version: "1.81.0", buildHash: "unknown" }),
    ).toBe(false);
    expect(
      isUpdateAvailable(
        { version: "1.81.0", buildHash: "unknown" },
        { version: "1.81.0", buildHash: "def" },
      ),
    ).toBe(false);
  });

  it("never flags on a null / unknown / empty latest", () => {
    expect(isUpdateAvailable(cur, null)).toBe(false);
    expect(isUpdateAvailable(cur, { version: "unknown", buildHash: "x" })).toBe(
      false,
    );
    expect(isUpdateAvailable(cur, { version: "", buildHash: "x" })).toBe(false);
  });
});

describe("parseVersionManifest", () => {
  it("parses a valid object", () => {
    expect(parseVersionManifest({ version: "1.0.0", buildHash: "h" })).toEqual({
      version: "1.0.0",
      buildHash: "h",
    });
  });

  it("passes a build date through when present (#1382)", () => {
    expect(
      parseVersionManifest({
        version: "1.0.0",
        buildHash: "h",
        buildDate: "2026-07-05T12:00:00Z",
      }),
    ).toEqual({
      version: "1.0.0",
      buildHash: "h",
      buildDate: "2026-07-05T12:00:00Z",
    });
  });

  it("defaults a missing buildHash to unknown", () => {
    expect(parseVersionManifest({ version: "1.0.0" })).toEqual({
      version: "1.0.0",
      buildHash: "unknown",
    });
  });

  it("rejects malformed input", () => {
    expect(parseVersionManifest(null)).toBeNull();
    expect(parseVersionManifest("x")).toBeNull();
    expect(parseVersionManifest({ buildHash: "h" })).toBeNull();
  });
});

describe("fetchLatestVersion", () => {
  it("fetches no-store WITH a cache-buster query and parses the manifest (#1382)", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: "2.0.0", buildHash: "z" }),
    })) as unknown as typeof fetch;
    const result = await fetchLatestVersion("/version.json", fetchImpl, () => 1234);
    expect(result).toEqual({ version: "2.0.0", buildHash: "z" });
    // ``no-store`` only bypasses the browser/SW caches; the cache-buster
    // param is what defeats the GH-Pages edge cache (#1382).
    expect(fetchImpl).toHaveBeenCalledWith("/version.json?cb=1234", {
      cache: "no-store",
    });
  });

  it("appends the cache-buster with & when the URL already has a query", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: "2.0.0", buildHash: "z" }),
    })) as unknown as typeof fetch;
    await fetchLatestVersion("/version.json?x=1", fetchImpl, () => 99);
    expect(fetchImpl).toHaveBeenCalledWith("/version.json?x=1&cb=99", {
      cache: "no-store",
    });
  });

  it("returns null on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false })) as unknown as typeof fetch;
    expect(await fetchLatestVersion("/version.json", fetchImpl)).toBeNull();
  });

  it("returns null when the fetch throws (offline)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await fetchLatestVersion("/version.json", fetchImpl)).toBeNull();
  });
});
