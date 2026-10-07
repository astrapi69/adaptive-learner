/**
 * S3 (PWA hardening) tests for the offline background-sync queue.
 *
 * Covers enqueue + cap, the FIFO replay contract (2xx removes, 4xx
 * drops as permanent, 5xx / network stops and preserves order), and the
 * empty-queue no-op.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearSyncQueue,
  enqueueRequest,
  getSyncQueue,
  replaySyncQueue,
  syncQueueSize,
} from "./sync-queue";

const ok = () => new Response("{}", { status: 200 });
const serverErr = () => new Response("err", { status: 503 });
const clientErr = () => new Response("dup", { status: 409 });

beforeEach(() => {
  clearSyncQueue();
});

afterEach(() => {
  clearSyncQueue();
  vi.restoreAllMocks();
});

describe("enqueueRequest", () => {
  it("appends items and reports the size", () => {
    enqueueRequest("/users/u/lesson-progress", "POST", { a: 1 });
    enqueueRequest("/users/u/lesson-progress", "POST", { a: 2 });
    expect(syncQueueSize()).toBe(2);
    expect(getSyncQueue()[0].body).toEqual({ a: 1 });
  });

  it("caps the queue at 50, dropping the oldest", () => {
    for (let i = 0; i < 60; i++) {
      enqueueRequest("/p", "POST", { n: i });
    }
    const q = getSyncQueue();
    expect(q).toHaveLength(50);
    // Oldest 10 dropped — first remaining is n=10, last is n=59.
    expect((q[0].body as { n: number }).n).toBe(10);
    expect((q[49].body as { n: number }).n).toBe(59);
  });
});

describe("replaySyncQueue", () => {
  it("is a no-op on an empty queue", async () => {
    const fetchImpl = vi.fn();
    const res = await replaySyncQueue(fetchImpl as unknown as typeof fetch);
    expect(res).toEqual({ replayed: 0, remaining: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("replays every item on success and empties the queue", async () => {
    enqueueRequest("/p", "POST", { n: 1 });
    enqueueRequest("/p", "POST", { n: 2 });
    const fetchImpl = vi.fn(async () => ok());

    const res = await replaySyncQueue(fetchImpl as unknown as typeof fetch);

    expect(res).toEqual({ replayed: 2, remaining: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(syncQueueSize()).toBe(0);
  });

  it("stops and preserves order on a network failure", async () => {
    enqueueRequest("/p", "POST", { n: 1 });
    enqueueRequest("/p", "POST", { n: 2 });
    enqueueRequest("/p", "POST", { n: 3 });
    // First ok, second throws (offline), third never attempted.
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockRejectedValueOnce(new TypeError("offline"));

    const res = await replaySyncQueue(fetchImpl as unknown as typeof fetch);

    expect(res.replayed).toBe(1);
    expect(res.remaining).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // stopped after the failure
    const q = getSyncQueue();
    expect(q.map((i) => (i.body as { n: number }).n)).toEqual([2, 3]);
  });

  it("drops a 4xx as permanent but keeps replaying the rest", async () => {
    enqueueRequest("/p", "POST", { n: 1 });
    enqueueRequest("/p", "POST", { n: 2 });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(clientErr()) // dropped
      .mockResolvedValueOnce(ok()); // applied

    const res = await replaySyncQueue(fetchImpl as unknown as typeof fetch);

    expect(res).toEqual({ replayed: 1, remaining: 0 });
    expect(syncQueueSize()).toBe(0);
  });

  it("keeps a 5xx item for a later retry", async () => {
    enqueueRequest("/p", "POST", { n: 1 });
    const fetchImpl = vi.fn(async () => serverErr());

    const res = await replaySyncQueue(fetchImpl as unknown as typeof fetch);

    expect(res).toEqual({ replayed: 0, remaining: 1 });
    expect(syncQueueSize()).toBe(1);
  });
});

describe("initSyncQueueReplay (#3429)", () => {
  it.each([
    { mode: "dexie" as const, calls: 0 },
    { mode: "api" as const, calls: 1 },
  ])("replays a queued write at startup only in API mode ($mode)", async ({ mode, calls }) => {
    // A queue restored from an API-mode backup onto a browser-mode device
    // must not be posted to a backend that is not there (or to a different
    // one): only the API mode that queued the writes replays them.
    vi.resetModules();
    const fresh = await import("./sync-queue");
    fresh.clearSyncQueue();
    fresh.enqueueRequest("/users/u/lesson-progress", "POST", { a: 1 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok());
    fresh.initSyncQueueReplay(mode);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchSpy).toHaveBeenCalledTimes(calls);
    fresh.clearSyncQueue();
  });
});
