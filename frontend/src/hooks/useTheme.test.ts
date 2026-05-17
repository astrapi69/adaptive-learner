/**
 * Tests for the useTheme hook (skeleton — light/dark only).
 *
 * Covers: localStorage persistence, system preference fallback,
 * dark/light toggle, DOM data-theme syncing.
 */

import {describe, it, expect, beforeEach} from "vitest"
import {renderHook, act} from "@testing-library/react"

import {useTheme} from "./useTheme"

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute("data-theme")
})

describe("useTheme", () => {
  describe("initial theme", () => {
    it("defaults to light when no stored preference and no system dark mode", () => {
      const {result} = renderHook(() => useTheme())
      expect(result.current.theme).toBe("light")
    })

    it("reads stored theme from localStorage", () => {
      localStorage.setItem("adaptive-learner-theme", "dark")
      const {result} = renderHook(() => useTheme())
      expect(result.current.theme).toBe("dark")
    })

    it("falls back to system preference when localStorage is empty", () => {
      // happy-dom's matchMedia always returns matches=false, so light is expected
      const {result} = renderHook(() => useTheme())
      expect(result.current.theme).toBe("light")
    })

    it("ignores invalid localStorage values", () => {
      localStorage.setItem("adaptive-learner-theme", "sepia")
      const {result} = renderHook(() => useTheme())
      expect(result.current.theme).toBe("light")
    })
  })

  describe("toggle", () => {
    it("toggles from light to dark", () => {
      const {result} = renderHook(() => useTheme())
      act(() => result.current.toggle())
      expect(result.current.theme).toBe("dark")
    })

    it("toggles from dark to light", () => {
      localStorage.setItem("adaptive-learner-theme", "dark")
      const {result} = renderHook(() => useTheme())
      act(() => result.current.toggle())
      expect(result.current.theme).toBe("light")
    })

    it("persists toggled theme to localStorage", () => {
      const {result} = renderHook(() => useTheme())
      act(() => result.current.toggle())
      expect(localStorage.getItem("adaptive-learner-theme")).toBe("dark")
    })

    it("sets data-theme attribute on document element", () => {
      const {result} = renderHook(() => useTheme())
      act(() => result.current.toggle())
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    })
  })
})
