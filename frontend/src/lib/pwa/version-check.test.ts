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
  it("fetches no-store and parses the manifest", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: "2.0.0", buildHash: "z" }),
    })) as unknown as typeof fetch;
    const result = await fetchLatestVersion("/version.json", fetchImpl);
    expect(result).toEqual({ version: "2.0.0", buildHash: "z" });
    expect(fetchImpl).toHaveBeenCalledWith("/version.json", {
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
