/**
 * #3973 / #3870 - no unit test reaches the network.
 *
 * `src/test/setup.ts` replaces the global `fetch` by one that rejects at
 * once, naming the URL. A request no test mocked then fails in the tick of
 * the code that made it, instead of seconds later as a connection error
 * logged into another file's teardown (the "Closing rpc while
 * onUserConsoleLog was pending" failure of the coverage run).
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {existsSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

import {
    expectUnmockedFetch,
    isBaselinedTestFile,
    recordUnmockedFetch,
    takeUnmockedFetches,
} from "./network-guard";
import baseline from "./unmocked-fetch-baseline.json";

afterEach(() => {
    vi.unstubAllGlobals();
});

// Every case here lets a request find no mock on purpose.
beforeEach(() => {
    expectUnmockedFetch();
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

describe("a request that found no mock is counted against its test (#3870)", () => {
    it("records the URL of every rejected request", async () => {
        await fetch("/api/a").catch(() => undefined);
        await fetch("/api/b").catch(() => undefined);

        expect(takeUnmockedFetches()).toEqual({urls: ["/api/a", "/api/b"], expected: true});
    });

    it("starts every test with an empty record and no exemption", () => {
        // The exemption of this file's beforeEach is taken here, as the
        // guard's afterEach takes it after every test.
        takeUnmockedFetches();

        expect(takeUnmockedFetches()).toEqual({urls: [], expected: false});
    });

    it("does not count a request a mock answered", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("mocked")));
        await fetch("/api/mocked");

        expect(takeUnmockedFetches().urls).toEqual([]);
    });

    it("hands the record over once", () => {
        recordUnmockedFetch("/api/once");

        expect(takeUnmockedFetches().urls).toEqual(["/api/once"]);
        expect(takeUnmockedFetches().urls).toEqual([]);
    });
});

describe("the baseline of files that still make un-mocked requests (#3870)", () => {
    const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const files = Object.keys(baseline.files);

    it("only shrinks: it holds at most the 61 files of the measuring run", () => {
        expect(files.length).toBeGreaterThan(0);
        expect(files.length).toBeLessThanOrEqual(61);
    });

    it("names only test files that exist", () => {
        // A renamed or deleted file must not keep an exemption nobody sees.
        expect(files.filter((file) => !existsSync(resolve(frontendRoot, file)))).toEqual([]);
    });

    it("exempts a listed file by the path Vitest reports, and no other", () => {
        expect(isBaselinedTestFile(`/any/checkout/frontend/${files[0]}`)).toBe(true);
        expect(isBaselinedTestFile("/any/checkout/frontend/src/test/network-guard.test.ts")).toBe(false);
        expect(isBaselinedTestFile(undefined)).toBe(false);
    });

    it("does not exempt this file: a new test file is held to the guard", () => {
        expect(isBaselinedTestFile(expect.getState().testPath)).toBe(false);
    });
});
