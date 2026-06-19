/**
 * Tests for the version.json-centric checkForUpdate primitive (#664).
 * happy-dom has no navigator.serviceWorker, so the best-effort SW nudge is
 * skipped and the result is driven purely by the injected fetch.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { activateAndReload, checkForUpdate } from "./sw-update";
import type { VersionManifest } from "./version-check";

const current: VersionManifest = { version: "1.85.0", buildHash: "aaaaaaa" };

function jsonFetch(body: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("checkForUpdate", () => {
  it("returns 'error' when version.json cannot be read (offline)", async () => {
    const offline = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const r = await checkForUpdate(current, "/version.json", offline);
    expect(r.status).toBe("error");
    expect(r.latestVersion).toBeNull();
  });

  it("returns 'error' on a non-ok response", async () => {
    const notOk = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const r = await checkForUpdate(current, "/version.json", notOk);
    expect(r.status).toBe("error");
  });

  it("returns 'current' when the deployed version matches", async () => {
    const r = await checkForUpdate(
      current,
      "/version.json",
      jsonFetch({ version: "1.85.0", buildHash: "aaaaaaa" }),
    );
    expect(r.status).toBe("current");
    expect(r.latestVersion).toBe("1.85.0");
  });

  it("returns 'available' when a newer version is deployed", async () => {
    const r = await checkForUpdate(
      current,
      "/version.json",
      jsonFetch({ version: "1.86.0", buildHash: "bbbbbbb" }),
    );
    expect(r.status).toBe("available");
    expect(r.latestVersion).toBe("1.86.0");
  });

  it("returns 'available' on a same-version, different-hash redeploy", async () => {
    const r = await checkForUpdate(
      current,
      "/version.json",
      jsonFetch({ version: "1.85.0", buildHash: "ccccccc" }),
    );
    expect(r.status).toBe("available");
  });
});

describe("activateAndReload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Regression pin (#818): the apply action must always reload. happy-dom has
  // no navigator.serviceWorker, so this exercises the no-registration
  // fallback — a plain reload, never a no-op.
  it("reloads when there is no service worker", async () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
    } as Location);

    await activateAndReload();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
