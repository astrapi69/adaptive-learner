import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const initMock = vi.hoisted(() => vi.fn());
vi.mock("eruda", () => ({default: {init: initMock}}));

// debugConsoleAvailable is evaluated at module load, so each context stubs
// the build flags then re-imports the module.
async function loadModule() {
    return import("./debug-console");
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    initMock.mockClear();
});

describe("debug console — compiled in (dev / LAN-debug build)", () => {
    beforeEach(() => {
        vi.stubEnv("VITE_DEBUG_CONSOLE", "1");
        vi.resetModules();
    });

    it("shouldLoadDebugConsole is false for a normal visit with no query string", async () => {
        const {shouldLoadDebugConsole} = await loadModule();
        expect(shouldLoadDebugConsole("")).toBe(false);
    });

    it("shouldLoadDebugConsole is false for unrelated query params", async () => {
        const {shouldLoadDebugConsole} = await loadModule();
        expect(shouldLoadDebugConsole("?vvdiag=1&e2e-hooks=1")).toBe(false);
    });

    it("shouldLoadDebugConsole is true when ?debug=1 is present", async () => {
        const {shouldLoadDebugConsole} = await loadModule();
        expect(shouldLoadDebugConsole("?debug=1")).toBe(true);
    });

    it("loadDebugConsole initializes eruda when available", async () => {
        const {loadDebugConsole} = await loadModule();
        await loadDebugConsole();
        expect(initMock).toHaveBeenCalledTimes(1);
    });
});

describe("debug console — shipped build (not compiled in)", () => {
    beforeEach(() => {
        // The shipped production/GH-Pages build: neither dev nor the
        // LAN-debug flag, so eruda is dead-code-eliminated (#2610).
        vi.stubEnv("DEV", false);
        vi.stubEnv("VITE_DEBUG_CONSOLE", "");
        vi.resetModules();
    });

    it("shouldLoadDebugConsole stays false even with ?debug=1", async () => {
        const {shouldLoadDebugConsole} = await loadModule();
        expect(shouldLoadDebugConsole("?debug=1")).toBe(false);
    });

    it("loadDebugConsole is a no-op — eruda is never loaded", async () => {
        const {loadDebugConsole} = await loadModule();
        await loadDebugConsole();
        expect(initMock).not.toHaveBeenCalled();
    });
});
