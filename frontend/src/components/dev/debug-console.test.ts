import {beforeEach, describe, expect, it, vi} from "vitest";

import {loadDebugConsole, shouldLoadDebugConsole} from "./debug-console";

describe("shouldLoadDebugConsole", () => {
    it("is false for a normal visit with no query string", () => {
        expect(shouldLoadDebugConsole("")).toBe(false);
    });

    it("is false for unrelated query params", () => {
        expect(shouldLoadDebugConsole("?vvdiag=1&e2e-hooks=1")).toBe(false);
    });

    it("is true when ?debug=1 is present", () => {
        expect(shouldLoadDebugConsole("?debug=1")).toBe(true);
    });

    it("is true for any debug value, matching the e2e-hooks presence check", () => {
        expect(shouldLoadDebugConsole("?debug=0")).toBe(true);
    });
});

const initMock = vi.hoisted(() => vi.fn());
vi.mock("eruda", () => ({default: {init: initMock}}));

describe("loadDebugConsole", () => {
    beforeEach(() => {
        initMock.mockClear();
    });

    it("initializes eruda when called", async () => {
        await loadDebugConsole();
        expect(initMock).toHaveBeenCalledTimes(1);
    });
});
