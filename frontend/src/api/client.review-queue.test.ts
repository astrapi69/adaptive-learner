/**
 * #3170 - the API client carries the "also review error-free elements"
 * toggle as the ``include_never_wrong`` query parameter, and sends
 * NOTHING for the default so the backend's own default (errors only)
 * applies.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {api} from "./client";

let urls: string[];

beforeEach(() => {
    urls = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
        urls.push(typeof input === "string" ? input : (input as URL).toString());
        return new Response("[]", {
            status: 200,
            headers: {"Content-Type": "application/json"},
        });
    }) as unknown as typeof fetch;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("api.elementErrors.reviewQueue (#3170)", () => {
    it("sends no include_never_wrong param by default", async () => {
        await api.elementErrors.reviewQueue("u1");
        expect(urls[0]).toBe("/api/users/u1/element-errors/review-queue");
    });

    it("forwards includeNeverWrong: true as include_never_wrong=true", async () => {
        await api.elementErrors.reviewQueue("u1", {includeNeverWrong: true});
        expect(urls[0]).toBe(
            "/api/users/u1/element-errors/review-queue?include_never_wrong=true",
        );
    });

    it("composes with set_id and limit", async () => {
        await api.elementErrors.reviewQueue("u1", {
            setId: "es-a1",
            limit: 5,
            includeNeverWrong: true,
        });
        expect(urls[0]).toBe(
            "/api/users/u1/element-errors/review-queue?set_id=es-a1&limit=5&include_never_wrong=true",
        );
    });

    it("an explicit false sends nothing (the backend default is errors only)", async () => {
        await api.elementErrors.reviewQueue("u1", {includeNeverWrong: false});
        expect(urls[0]).toBe("/api/users/u1/element-errors/review-queue");
    });
});
