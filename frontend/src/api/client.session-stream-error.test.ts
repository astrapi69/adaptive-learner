/**
 * #3377 - the tutor chat's SSE stream fails the way every other API call
 * does: an ``ApiError`` with the backend's ``detail`` (not a plain
 * ``Error`` carrying the raw JSON body), status 0 when no response came,
 * and the call recorded for the report dialog.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const {recorded} = vi.hoisted(() => ({recorded: [] as Array<Record<string, unknown>>}));

vi.mock("../utils/eventRecorder", () => ({
    eventRecorder: {add: (entry: Record<string, unknown>) => recorded.push(entry)},
}));

import {ApiError, api} from "./client";

const ENDPOINT = "/plugins/session/s1/message/stream";

function stream() {
    return api.session.streamMessage(
        "s1",
        {role: "user", content: "Hola"},
        {onChunk: () => {}, onDone: () => {}},
    );
}

beforeEach(() => {
    recorded.length = 0;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("session.streamMessage failures (#3377)", () => {
    it("rejects a non-2xx response with an ApiError carrying the backend detail", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({detail: "Session s1 not found"}), {status: 404}),
        );
        const failure = await stream().catch((err: unknown) => err);
        expect(failure).toBeInstanceOf(ApiError);
        expect([
            (failure as ApiError).status,
            (failure as ApiError).detail,
            (failure as ApiError).endpoint,
        ]).toEqual([404, "Session s1 not found", ENDPOINT]);
    });

    it("rejects a request that gets no response with an ApiError of status 0", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
        const failure = await stream().catch((err: unknown) => err);
        expect(failure).toBeInstanceOf(ApiError);
        expect((failure as ApiError).status).toBe(0);
    });

    it("records the call like apiCall does", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({detail: "boom"}), {status: 500}),
        );
        await stream().catch(() => undefined);
        expect(recorded).toContainEqual(
            expect.objectContaining({
                type: "api_call",
                method: "POST",
                endpoint: ENDPOINT,
                status: 500,
            }),
        );
    });
});
