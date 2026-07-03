import {createElement} from "react";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, it, expect, vi} from "vitest";

import {I18nProvider, useI18n} from "./useI18n";
import {
    DISCOVER_SOURCE_LANGUAGE_KEY,
    readDiscoverSourceLanguage,
    writeDiscoverSourceLanguage,
} from "../../lib/content/repos/discoverLanguagePref";

vi.mock("../../storage", () => ({
    getStorage: () => ({
        settings: {getApp: vi.fn().mockResolvedValue({app: {default_language: "de"}})},
        i18n: {get: vi.fn().mockResolvedValue({})},
    }),
}));

// Test the t() function logic directly (without React hooks)
function createT(strings: Record<string, unknown>) {
    return (key: string, fallback?: string): string => {
        const parts = key.split(".");
        let current: unknown = strings;
        for (const part of parts) {
            if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
                current = (current as Record<string, unknown>)[part];
            } else {
                return fallback || key;
            }
        }
        return typeof current === "string" ? current : (fallback || key);
    };
}

describe("i18n t() function", () => {
    const strings = {
        ui: {
            common: {save: "Speichern", cancel: "Abbrechen"},
            editor: {saving: "Speichert...", saved: "Gespeichert"},
            chapter_types: {chapter: "Kapitel", preface: "Vorwort"},
        },
    };
    const t = createT(strings);

    it("resolves dot-notation keys", () => {
        expect(t("ui.common.save")).toBe("Speichern");
        expect(t("ui.editor.saving")).toBe("Speichert...");
    });

    it("resolves nested keys", () => {
        expect(t("ui.chapter_types.chapter")).toBe("Kapitel");
        expect(t("ui.chapter_types.preface")).toBe("Vorwort");
    });

    it("returns fallback for missing keys", () => {
        expect(t("ui.missing.key", "Fallback")).toBe("Fallback");
    });

    it("returns key as fallback when no fallback provided", () => {
        expect(t("ui.missing.key")).toBe("ui.missing.key");
    });

    it("handles partial path matches", () => {
        expect(t("ui.common", "Fallback")).toBe("Fallback");
    });

    it("handles empty strings", () => {
        expect(t("", "Fallback")).toBe("Fallback");
    });
});

// A UI-language switch resets the Discover content-language filter to the new
// language, overriding even an explicit choice (#1347).
describe("setLang resets the Discover content-language filter (#1347)", () => {
    function LangHarness() {
        const {lang, setLang} = useI18n();
        return createElement(
            "div",
            null,
            createElement("span", {"data-testid": "lang"}, lang),
            createElement(
                "button",
                {"data-testid": "to-en", onClick: () => setLang("en")},
                "en",
            ),
            createElement(
                "button",
                {"data-testid": "to-fr", onClick: () => setLang("fr")},
                "fr",
            ),
            createElement(
                "button",
                {"data-testid": "to-de", onClick: () => setLang("de")},
                "de",
            ),
        );
    }

    function renderHarness() {
        return render(createElement(I18nProvider, null, createElement(LangHarness)));
    }

    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    // A module-level language cache persists across tests, so each test first
    // drives the UI to a known "de" baseline (a no-op reset while no pref is
    // stored), then seeds the pref, then exercises the switch under test.
    async function baselineDe() {
        renderHarness();
        await act(async () => {
            fireEvent.click(screen.getByTestId("to-de"));
        });
    }

    it("switching de→en clears an explicit 'All languages' choice (filter follows the switch)", async () => {
        await baselineDe();
        writeDiscoverSourceLanguage(""); // explicit "All"
        expect(readDiscoverSourceLanguage()).toBe("");
        await act(async () => {
            fireEvent.click(screen.getByTestId("to-en"));
        });
        expect(screen.getByTestId("lang").textContent).toBe("en");
        // Override dropped → filter falls back to the new UI-locale default.
        expect(readDiscoverSourceLanguage()).toBeNull();
    });

    it("clears an explicit language choice too, not only 'All'", async () => {
        await baselineDe();
        writeDiscoverSourceLanguage("de"); // explicit German
        await act(async () => {
            fireEvent.click(screen.getByTestId("to-en"));
        });
        expect(readDiscoverSourceLanguage()).toBeNull();
    });

    it("a further UI switch resets again to the new language", async () => {
        await baselineDe();
        await act(async () => {
            fireEvent.click(screen.getByTestId("to-en"));
        });
        // A fresh choice made after the switch persists…
        writeDiscoverSourceLanguage("");
        expect(readDiscoverSourceLanguage()).toBe("");
        // …until the next UI-language switch, which resets it again.
        await act(async () => {
            fireEvent.click(screen.getByTestId("to-fr"));
        });
        expect(screen.getByTestId("lang").textContent).toBe("fr");
        expect(readDiscoverSourceLanguage()).toBeNull();
    });

    it("re-selecting the SAME language does not touch the choice", async () => {
        await baselineDe();
        // UI language is now "de"; choosing "de" again is a no-op → no reset.
        writeDiscoverSourceLanguage("");
        await act(async () => {
            fireEvent.click(screen.getByTestId("to-de"));
        });
        expect(screen.getByTestId("lang").textContent).toBe("de");
        expect(readDiscoverSourceLanguage()).toBe("");
        expect(localStorage.getItem(DISCOVER_SOURCE_LANGUAGE_KEY)).toBe("");
    });
});
