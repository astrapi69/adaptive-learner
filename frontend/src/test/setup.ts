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
