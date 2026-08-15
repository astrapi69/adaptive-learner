import {beforeEach, describe, expect, it, vi} from "vitest";

import {
    debugConsoleEnabled,
    loadDebugConsole,
    shouldLoadDebugConsole,
} from "./debug-console";

describe("debugConsoleEnabled (#2610)", () => {
    it("is false in a shipped build (no DEV, no flag)", () => {
        expect(debugConsoleEnabled({DEV: false})).toBe(false);
    });

    it("is true in local dev", () => {
        expect(debugConsoleEnabled({DEV: true})).toBe(true);
    });

    it("is true when the LAN-debug build flag is set", () => {
        expect(
            debugConsoleEnabled({DEV: false, VITE_DEBUG_CONSOLE: "1"}),
        ).toBe(true);
    });

    it("is false for any other flag value", () => {
        expect(
            debugConsoleEnabled({DEV: false, VITE_DEBUG_CONSOLE: "0"}),
        ).toBe(false);
        expect(
            debugConsoleEnabled({DEV: false, VITE_DEBUG_CONSOLE: "true"}),
        ).toBe(false);
    });
});

describe("shouldLoadDebugConsole", () => {
    it("is false even with ?debug=1 when the build carries no console (#2610)", () => {
        expect(shouldLoadDebugConsole("?debug=1", {DEV: false})).toBe(false);
    });

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
