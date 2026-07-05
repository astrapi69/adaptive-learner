/**
 * Tests for the version.json-centric checkForUpdate primitive (#664).
 * happy-dom has no navigator.serviceWorker, so the best-effort SW nudge is
 * skipped and the result is driven purely by the injected fetch.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activateAndReload,
  activateInBackground,
  checkForUpdate,
  checkForUpdateReliable,
} from "./sw-update";
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

describe("checkForUpdateReliable (#1374 — awaits the SW cycle)", () => {
  interface FakeWorker {
    state: string;
    addEventListener: (ev: string, cb: () => void) => void;
    emitStateChange: () => void;
  }
  function makeWorker(state = "installing"): FakeWorker {
    const cbs: Array<() => void> = [];
    return {
      state,
      addEventListener: (_ev, cb) => cbs.push(cb),
      emitStateChange: () => cbs.forEach((c) => c()),
    };
  }
  function makeReg(opts: {
    waiting?: unknown;
    installing?: FakeWorker | null;
  }): ServiceWorkerRegistration {
    return {
      waiting: opts.waiting,
      installing: opts.installing ?? null,
      addEventListener: vi.fn(),
      update: vi.fn(async () => {}),
    } as unknown as ServiceWorkerRegistration;
  }
  const currentJson = jsonFetch({ version: "1.85.0", buildHash: "aaaaaaa" });

  it("'available' immediately when a worker is already waiting (wins over a matching version.json)", async () => {
    const r = await checkForUpdateReliable({
      current,
      url: "/v.json",
      fetchImpl: currentJson,
      getRegistration: async () => makeReg({ waiting: {} }),
      hasController: () => true,
      timeoutMs: 100,
    });
    expect(r.status).toBe("available");
  });

  it("'available' on a newer version.json with no service worker", async () => {
    const r = await checkForUpdateReliable({
      current,
      url: "/v.json",
      fetchImpl: jsonFetch({ version: "1.86.0", buildHash: "bbbbbbb" }),
      getRegistration: async () => null,
      hasController: () => false,
      timeoutMs: 100,
    });
    expect(r.status).toBe("available");
    expect(r.latestVersion).toBe("1.86.0");
  });

  it("'available' when an installing worker reaches 'installed' under a controller", async () => {
    const worker = makeWorker("installing");
    const reg = makeReg({ installing: worker });
    const p = checkForUpdateReliable({
      current,
      url: "/v.json",
      fetchImpl: currentJson,
      getRegistration: async () => reg,
      hasController: () => true,
      timeoutMs: 1000,
    });
    // Let reg.update() resolve and the installing-watcher attach.
    await Promise.resolve();
    await Promise.resolve();
    worker.state = "installed";
    worker.emitStateChange();
    expect((await p).status).toBe("available");
  });

  it("'current' fast-path when reg.update() yields no new worker (no timeout wait)", async () => {
    const r = await checkForUpdateReliable({
      current,
      url: "/v.json",
      fetchImpl: currentJson,
      getRegistration: async () => makeReg({}),
      hasController: () => false,
      timeoutMs: 5000,
    });
    expect(r.status).toBe("current");
  });

  it("'error' when version.json is unreadable and no worker is waiting", async () => {
    const offline = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    const r = await checkForUpdateReliable({
      current,
      url: "/v.json",
      fetchImpl: offline,
      getRegistration: async () => null,
      hasController: () => false,
      timeoutMs: 100,
    });
    expect(r.status).toBe("error");
    expect(r.latestVersion).toBeNull();
  });

  it("times out to a non-blocking result when the SW cycle stalls", async () => {
    const worker = makeWorker("installing"); // never advances
    const r = await checkForUpdateReliable({
      current,
      url: "/v.json",
      fetchImpl: currentJson,
      getRegistration: async () => makeReg({ installing: worker }),
      hasController: () => true,
      timeoutMs: 20,
    });
    expect(r.status).toBe("current");
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

describe("activateInBackground (#846)", () => {
  /** Install a fake navigator.serviceWorker that never takes control. */
  function stubServiceWorker(reg: Partial<ServiceWorkerRegistration> | null) {
    const sw = {
      getRegistration: vi.fn(async () => reg ?? undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: sw,
      configurable: true,
    });
    return sw;
  }

  afterEach(() => {
    // Remove the stub so the other tests (which rely on its absence) are clean.
    if ("serviceWorker" in navigator) {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    }
    vi.restoreAllMocks();
  });

  it("reloads once when there is no service-worker registration", async () => {
    stubServiceWorker(null);
    const reload = vi.fn();
    await activateInBackground({ reload, sleep: async () => {} });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // Core #846 contract: a SW that never yields a waiting worker / never fires
  // controllerchange must be retried up to maxAttempts, then give up SILENTLY —
  // no reload, so a stale build is never force-loaded into a re-banner loop.
  it("retries up to maxAttempts then stops silently (no reload)", async () => {
    const update = vi.fn(async () => {});
    // `waiting` stays undefined and no controllerchange ever fires.
    const reg = { update, waiting: undefined } as unknown as ServiceWorkerRegistration;
    stubServiceWorker(reg);
    const reload = vi.fn();

    await activateInBackground({
      reload,
      maxAttempts: 15,
      now: () => 0, // freeze the clock so maxTotalMs never trips first
      sleep: async () => {}, // instant backoff
    });

    expect(update).toHaveBeenCalledTimes(15);
    expect(reload).not.toHaveBeenCalled();
  });

  it("stops at the total-time ceiling before exhausting all attempts", async () => {
    const update = vi.fn(async () => {});
    const reg = { update, waiting: undefined } as unknown as ServiceWorkerRegistration;
    stubServiceWorker(reg);
    const reload = vi.fn();

    // Clock jumps 30s per read; with a 60s ceiling the loop ends well before 15.
    let clock = 0;
    await activateInBackground({
      reload,
      maxAttempts: 15,
      maxTotalMs: 60_000,
      now: () => (clock += 30_000),
      sleep: async () => {},
    });

    expect(update.mock.calls.length).toBeLessThan(15);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads when the fresh worker takes control (controllerchange)", async () => {
    const update = vi.fn(async () => {});
    const reg = { update, waiting: undefined } as unknown as ServiceWorkerRegistration;
    const sw = stubServiceWorker(reg);
    // Fire controllerchange on the first registered listener after one tick.
    sw.addEventListener.mockImplementation(
      (event: string, cb: () => void) => {
        if (event === "controllerchange") queueMicrotask(cb);
      },
    );
    const reload = vi.fn();

    await activateInBackground({
      reload,
      maxAttempts: 15,
      now: () => 0,
      sleep: async () => {},
    });

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
