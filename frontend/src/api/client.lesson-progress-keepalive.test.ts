/**
 * #3364 - a lesson-progress write must survive the page going away. The
 * pause on ``beforeunload`` and the flush on ``pagehide`` are fetches the
 * browser cancels on unload unless they carry ``keepalive``.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {api} from "./client";

let inits: (RequestInit | undefined)[];

beforeEach(() => {
    inits = [];
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        inits.push(init);
        return new Response("{}", {status: 200, headers: {"Content-Type": "application/json"}});
    }) as unknown as typeof fetch;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("api.lessonProgress.upsert (#3364)", () => {
    it("sends the write with keepalive so an unload does not cancel it", async () => {
        await api.lessonProgress.upsert("u1", {
            source: "jane/repo",
            set_id: "es-a1",
            lesson_filename: "01.json",
            mark_paused: true,
        });
        expect(inits[0]?.keepalive).toBe(true);
    });

    it("keeps other calls without keepalive", async () => {
        await api.lessonProgress.list("u1");
        expect(inits[0]?.keepalive).toBeUndefined();
    });
});
