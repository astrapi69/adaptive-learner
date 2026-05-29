/**
 * Tests for the useTheme hook (Phase 58E — 6 themes + auto).
 *
 * Covers: dotted-key persistence, legacy-key migration, system-
 * preference auto fallback, the 6 valid themes, invalid-value
 * rejection, the light/dark quick-toggle, and DOM data-theme syncing.
 * happy-dom's matchMedia returns matches=false, so auto resolves light.
 */

import {describe, it, expect, beforeEach} from "vitest"
import {renderHook, act} from "@testing-library/react"

import {useTheme} from "./useTheme"

const KEY = "adaptive-learner.theme"
const LEGACY = "adaptive-learner-theme"

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute("data-theme")
})

describe("useTheme", () => {
  describe("initial theme", () => {
    it("defaults to auto -> light when no stored preference (system not dark)", () => {
      const {result} = renderHook(() => useTheme())
      expect(result.current.choice).toBe("auto")
      expect(result.current.theme).toBe("light")
    })

    it("reads a stored choice from the dotted key", () => {
      localStorage.setItem(KEY, "ocean")
      const {result} = renderHook(() => useTheme())
      expect(result.current.theme).toBe("ocean")
    })

    it("accepts every shipped theme", () => {
      for (const id of ["light", "dark", "ocean", "forest", "high-contrast", "sepia"]) {
        localStorage.setItem(KEY, id)
        const {result} = renderHook(() => useTheme())
        expect(result.current.theme).toBe(id)
      }
    })

    it("migrates the pre-58E legacy hyphen key to the dotted key", () => {
      localStorage.setItem(LEGACY, "dark")
      const {result} = renderHook(() => useTheme())
      expect(result.current.theme).toBe("dark")
      expect(localStorage.getItem(KEY)).toBe("dark")
      expect(localStorage.getItem(LEGACY)).toBeNull()
    })

    it("ignores invalid stored values and falls back to auto", () => {
      localStorage.setItem(KEY, "rainbow")
      const {result} = renderHook(() => useTheme())
      expect(result.current.choice).toBe("auto")
      expect(result.current.theme).toBe("light")
    })
  })

  describe("setChoice", () => {
    it("applies and persists a concrete theme", () => {
      const {result} = renderHook(() => useTheme())
      act(() => result.current.setChoice("forest"))
      expect(result.current.theme).toBe("forest")
      expect(localStorage.getItem(KEY)).toBe("forest")
      expect(document.documentElement.getAttribute("data-theme")).toBe("forest")
    })

    it("persists the auto choice", () => {
      const {result} = renderHook(() => useTheme())
      act(() => result.current.setChoice("dark"))
      act(() => result.current.setChoice("auto"))
      expect(localStorage.getItem(KEY)).toBe("auto")
      // auto -> light under happy-dom (matches=false)
      expect(result.current.theme).toBe("light")
    })
  })

  describe("toggle (nav quick light/dark flip)", () => {
    it("flips from a light-family theme to dark", () => {
      const {result} = renderHook(() => useTheme())
      act(() => result.current.toggle())
      expect(result.current.theme).toBe("dark")
    })

    it("flips from a dark-family theme to light", () => {
      localStorage.setItem(KEY, "ocean")
      const {result} = renderHook(() => useTheme())
      act(() => result.current.toggle())
      expect(result.current.theme).toBe("light")
    })

    it("sets the data-theme attribute on the document element", () => {
      const {result} = renderHook(() => useTheme())
      act(() => result.current.toggle())
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    })
  })
})
