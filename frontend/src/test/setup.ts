// Vitest setup file
// Extends vitest matchers with jest-dom matchers (toBeDisabled, toBeVisible, etc.)
import "@testing-library/jest-dom/vitest"
import {afterEach, expect} from "vitest"

import {isBaselinedTestFile, recordUnmockedFetch, takeUnmockedFetches} from "./network-guard"

// #3973 / #3870: no unit test reaches the network.
//
// A fetch no test mocked used to go out for real: a relative URL against
// happy-dom's default origin http://localhost:3000 (nothing listens there),
// an absolute one to its host. The connection error came back seconds later
// and was logged into whatever was running by then; when that was a
// worker's teardown, Vitest failed the whole run ("Closing rpc while
// onUserConsoleLog was pending") with every test green.
//
// So an un-mocked fetch rejects at once, naming the URL, like a network
// failure does (a TypeError). A test that needs a response installs its own
// mock (vi.stubGlobal, vi.spyOn, plain assignment), which replaces this one;
// vi.unstubAllGlobals brings it back. data: and blob: URLs never leave the
// process and keep the real fetch.
if (typeof globalThis.fetch === "function") {
    const realFetch = globalThis.fetch.bind(globalThis)
    const urlOf = (input: RequestInfo | URL): string => {
        if (typeof input === "string") return input
        return input instanceof URL ? input.href : input.url
    }
    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = urlOf(input)
        if (url.startsWith("data:") || url.startsWith("blob:")) return realFetch(input, init)
        recordUnmockedFetch(url)
        return Promise.reject(
            new TypeError(`fetch("${url}") is not mocked: unit tests do not reach the network`),
        )
    }
}

// #3870: rejecting the request made it harmless, it did not make the test
// mock it. 53 tests of the settings page ran with their purchase ledger
// unreachable, every time, and presented themselves as tests of the normal
// case: the code under test caught the rejection and went on. So a test in
// which a request found no mock fails, and names the URLs. A test that
// means the network to be unreachable says so with
// ``expectUnmockedFetch()`` from ./network-guard.
//
// The measuring run found 471 such tests in 61 files, not 53. Those files
// are listed in ./unmocked-fetch-baseline.json and are not failed yet; the
// list only shrinks. Every other file, and every new one, is held to it.
afterEach(() => {
    const {urls, expected} = takeUnmockedFetches()
    if (urls.length === 0 || expected) return
    if (isBaselinedTestFile(expect.getState().testPath)) return
    const unique = [...new Set(urls)]
    throw new Error(
        `${urls.length} request(s) in this test found no mock: ${unique.join(", ")}. ` +
            "Mock the call, or call expectUnmockedFetch() if the test means the network to be unreachable.",
    )
})

// Radix UI primitives (Select, etc.) rely on a few DOM APIs that
// happy-dom does not implement. Polyfill them so portal-based
// components can open/close and scroll in the test environment.
if (typeof Element !== "undefined") {
    if (!Element.prototype.hasPointerCapture) {
        Element.prototype.hasPointerCapture = () => false
    }
    if (!Element.prototype.setPointerCapture) {
        Element.prototype.setPointerCapture = () => {}
    }
    if (!Element.prototype.releasePointerCapture) {
        Element.prototype.releasePointerCapture = () => {}
    }
    if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = () => {}
    }
}

if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
}

// #1345: break happy-dom's synchronous focus-event recursion.
//
// happy-dom dispatches "focus"/"blur" events *synchronously* inside
// .focus()/.blur(); real browsers queue them on a task and coalesce.
// Radix focus-scope (>=1.1.11, pulled by @radix-ui/react-select 2.3.2+)
// added a focus-guard that re-focuses on focusout, so under happy-dom two
// guard sentinels re-focus each other without bound -> "RangeError:
// Maximum call stack size exceeded", crashing <SelectContentImpl> so a
// Select never renders its options. This is a synchronous-dispatch test
// artifact only; a real browser never exhibits it.
//
// Counter-proof for that claim (#2284): e2e/dexie/import-language-pipeline
// .spec.ts opens a Radix Select in real Chromium and clicks a
// portal-rendered option - it would die with the same RangeError if a
// real browser had the recursion. That spec carries this duty on purpose;
// if its Select interaction is removed, this patch loses its only proof.
//
// Fix: within ONE synchronous focus cascade, ignore a repeat .focus() on an
// element already visited in that cascade -- exactly the pathological
// A -> B -> A ping-pong. Linear focus moves inside a handler (A -> B -> C,
// no repeats) are untouched, so legitimate focus management is unaffected.
if (typeof HTMLElement !== "undefined") {
    const proto = HTMLElement.prototype
    const nativeFocus = proto.focus
    let cascade: Set<Element> | null = null
    proto.focus = function focusNoSyncCycle(this: HTMLElement, options?: FocusOptions): void {
        const isTop = cascade === null
        if (cascade === null) cascade = new Set<Element>()
        if (cascade.has(this)) return // cyclic re-focus within one cascade
        cascade.add(this)
        try {
            nativeFocus.call(this, options)
        } finally {
            if (isTop) cascade = null
        }
    }
}
