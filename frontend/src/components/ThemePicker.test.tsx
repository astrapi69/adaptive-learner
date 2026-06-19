/**
 * ThemePicker (Phase 58E) — renders a card per theme + auto, switches
 * instantly via useTheme (persists to localStorage, sets data-theme).
 */

import {describe, it, expect, beforeEach, vi} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";

import ThemePicker from "./ThemePicker";

vi.mock("../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        lang: "en",
        setLang: vi.fn(),
    }),
}));

beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
});

describe("ThemePicker", () => {
    it("renders auto + the recommended themes by default; the Classic tab reveals the rest", () => {
        render(<ThemePicker />);
        for (const id of [
            "auto",
            "catppuccin-latte",
            "supabase",
            "graphite",
            "catppuccin-mocha",
            "soft-pop",
            "amethyst-haze",
        ]) {
            expect(screen.getByTestId(`settings-theme-${id}`)).toBeTruthy();
        }
        // Classic themes are hidden until the Classic sub-tab is selected.
        expect(screen.queryByTestId("settings-theme-forest")).toBeNull();
        fireEvent.click(screen.getByTestId("theme-group-classic"));
        for (const id of [
            "light",
            "dark",
            "ocean",
            "forest",
            "high-contrast",
            "sepia",
        ]) {
            expect(screen.getByTestId(`settings-theme-${id}`)).toBeTruthy();
        }
    });

    it("switching to a theme persists the choice and applies data-theme", () => {
        render(<ThemePicker />);
        fireEvent.click(screen.getByTestId("theme-group-classic"));
        fireEvent.click(screen.getByTestId("settings-theme-forest"));
        expect(localStorage.getItem("adaptive-learner.theme")).toBe("forest");
        expect(document.documentElement.getAttribute("data-theme")).toBe("forest");
    });

    it("marks the active choice", () => {
        localStorage.setItem("adaptive-learner.theme", "ocean");
        render(<ThemePicker />);
        const oceanRadio = screen.getByTestId("settings-theme-ocean") as HTMLInputElement;
        expect(oceanRadio.checked).toBe(true);
    });
});
