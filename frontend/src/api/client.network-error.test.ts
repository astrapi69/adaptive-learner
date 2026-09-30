/**
 * #3388 - a fetch that never gets a response (backend stopped, launcher
 * down, offline in API mode) surfaces as ``ApiError`` with status 0, so
 * the friendly mapper shows the localized "No connection to the server"
 * instead of the browser's raw "Failed to fetch".
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {ApiError, api} from "./client";
import {friendlyErrorMessage} from "../utils/errorMessages";

beforeEach(() => {
    global.fetch = vi.fn(async () => {
        throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("apiCall network failure (#3388)", () => {
    it("rejects with an ApiError of status 0 that names the endpoint", async () => {
        const failure = await api.lessonProgress.list("u1").catch((err: unknown) => err);
        expect(failure).toBeInstanceOf(ApiError);
        expect((failure as ApiError).status).toBe(0);
        expect((failure as ApiError).endpoint).toBe("/users/u1/lesson-progress");
        expect((failure as ApiError).detail).toContain("Failed to fetch");
    });

    it("maps status 0 to the network message", () => {
        expect(friendlyErrorMessage(new ApiError(0, "Failed to fetch"))).toBe(
            "No connection to the server.",
        );
    });
});
