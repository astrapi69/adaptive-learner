// Vitest setup file
// Extends vitest matchers with jest-dom matchers (toBeDisabled, toBeVisible, etc.)
import "@testing-library/jest-dom/vitest"

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
