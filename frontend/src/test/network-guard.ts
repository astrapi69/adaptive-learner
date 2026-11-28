/**
 * The bookkeeping of the unit-test network guard (#3870): which requests of
 * the running test found no mock, and whether the test said it expects that.
 * ``src/test/setup.ts`` records and checks; a test only calls
 * {@link expectUnmockedFetch}.
 */

import baseline from "./unmocked-fetch-baseline.json"

const BASELINED: ReadonlySet<string> = new Set(Object.keys(baseline.files))

let urls: string[] = []
let expected = false

/** Called by the guard for every request it rejects. */
export function recordUnmockedFetch(url: string): void {
    urls.push(url)
}

/**
 * Say that this test means the network to be unreachable, so a request that
 * finds no mock does not fail it. Holds for the running test only.
 *
 * @example
 * it("keeps the local value when the server cannot be reached", async () => {
 *     expectUnmockedFetch()
 *     ...
 * })
 */
export function expectUnmockedFetch(): void {
    expected = true
}

/** Hand the running test's record to the guard and start a new one. */
export function takeUnmockedFetches(): {urls: string[]; expected: boolean} {
    const taken = {urls, expected}
    urls = []
    expected = false
    return taken
}

/**
 * Whether a test file is on the baseline of files that still make un-mocked
 * requests (./unmocked-fetch-baseline.json).
 *
 * @param testPath - The absolute path Vitest reports for the running file.
 */
export function isBaselinedTestFile(testPath: string | undefined): boolean {
    if (testPath === undefined) return false
    const at = testPath.replaceAll("\\", "/").lastIndexOf("/src/")
    return at !== -1 && BASELINED.has(testPath.replaceAll("\\", "/").slice(at + 1))
}
