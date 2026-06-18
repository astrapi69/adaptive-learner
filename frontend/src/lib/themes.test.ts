/**
 * Tests for the theme registry helpers.
 *
 * ``isDarkTheme`` drives the dark icon variant in the nav/landing
 * header, so it must agree with each theme's declared ``family``.
 */
import {describe, it, expect} from "vitest"

import {isDarkTheme, THEMES, type ThemeId} from "./themes"

describe("isDarkTheme", () => {
    it("returns true for every dark-family theme", () => {
        const darkIds = THEMES.filter((meta) => meta.family === "dark").map((meta) => meta.id)
        expect(darkIds.length).toBeGreaterThan(0)
        for (const id of darkIds) {
            expect(isDarkTheme(id)).toBe(true)
        }
    })

    it("returns false for every light-family theme", () => {
        const lightIds = THEMES.filter((meta) => meta.family === "light").map((meta) => meta.id)
        expect(lightIds.length).toBeGreaterThan(0)
        for (const id of lightIds) {
            expect(isDarkTheme(id)).toBe(false)
        }
    })

    it("treats an unknown id as light (fails safe)", () => {
        expect(isDarkTheme("does-not-exist" as ThemeId)).toBe(false)
    })
})
