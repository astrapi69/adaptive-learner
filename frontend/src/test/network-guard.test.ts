/**
 * #3973 / #3870 - no unit test reaches the network.
 *
 * `src/test/setup.ts` replaces the global `fetch` by one that rejects at
 * once, naming the URL. A request no test mocked then fails in the tick of
 * the code that made it, instead of seconds later as a connection error
 * logged into another file's teardown (the "Closing rpc while
 * onUserConsoleLog was pending" failure of the coverage run).
 */

import {afterEach, describe, expect, it, vi} from "vitest";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the unit-test network guard", () => {
    it.each([
        ["a relative URL (happy-dom would resolve it to localhost:3000)", "/api/i18n/de"],
        ["an absolute URL to a foreign host", "https://raw.githubusercontent.com/o/r/main/manifest.yaml"],
    ])("rejects %s at once and names it", async (_label, url) => {
        const started = Date.now();
        const error = await fetch(url).then(
            () => null,
            (reason: unknown) => reason,
        );
        expect(error).toBeInstanceOf(TypeError);
        expect((error as TypeError).message).toContain(url);
        expect((error as TypeError).message).toMatch(/not mocked/);
        // A real connection attempt takes far longer than this to fail.
        expect(Date.now() - started).toBeLessThan(200);
    });

    it("names the URL of a Request and of a URL object too", async () => {
        const fromRequest = await fetch(new Request("https://example.org/a")).catch((e: Error) => e.message);
        const fromUrl = await fetch(new URL("https://example.org/b")).catch((e: Error) => e.message);
        expect(fromRequest).toContain("https://example.org/a");
        expect(fromUrl).toContain("https://example.org/b");
    });

    it("gives way to a test's own mock, and is back after the mock is removed", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("mocked")));
        expect(await (await fetch("/anything")).text()).toBe("mocked");

        vi.unstubAllGlobals();
        await expect(fetch("/anything")).rejects.toThrow(/not mocked/);
    });
});
