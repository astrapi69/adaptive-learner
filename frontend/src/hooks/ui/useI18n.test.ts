import {createElement} from "react";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, it, expect, vi} from "vitest";

import {
    I18nProvider,
    isUiLanguage,
    readSavedLang,
    resolveInitialUiLanguage,
    useI18n,
} from "./useI18n";
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
                return fallback ?? key;
            }
        }
        return typeof current === "string" ? current : (fallback ?? key);
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

    it("respects an explicit empty-string fallback instead of leaking the raw key (#1667)", () => {
        expect(t("ui.missing.key", "")).toBe("");
    });
});

describe("resolveInitialUiLanguage — persisted UI language survives a reload (#1333)", () => {
    it("returns the saved choice (the reported el regression)", () => {
        // A Greek choice persisted before an update must be honoured, not
        // dropped to the "de" default.
        expect(resolveInitialUiLanguage({saved: "el"})).toBe("el");
    });

    it("lets the saved choice WIN over the app-config default", () => {
        // Dexie getApp() is empty, but even an explicit app default must not
        // overwrite the user's stored choice.
        expect(
            resolveInitialUiLanguage({saved: "el", appDefault: "de"}),
        ).toBe("el");
    });

    it("falls back to the app default when nothing is saved", () => {
        expect(resolveInitialUiLanguage({saved: null, appDefault: "fr"})).toBe("fr");
    });

    it("defaults to 'de' when nothing resolves (unchanged no-choice default)", () => {
        expect(resolveInitialUiLanguage({})).toBe("de");
        expect(resolveInitialUiLanguage({saved: "xx"})).toBe("de");
        // A non-UI app default is ignored rather than used verbatim.
        expect(resolveInitialUiLanguage({appDefault: "zz"})).toBe("de");
    });

    it("accepts every shipped UI language, not just the legacy five", () => {
        // Regression guard: the old ``isSupportedLang`` constant listed only
        // de/en/es/fr/el, which would have rejected these saved choices.
        for (const code of ["ko", "ja", "hi", "id", "pt", "tr", "el"]) {
            expect(isUiLanguage(code)).toBe(true);
            expect(resolveInitialUiLanguage({saved: code})).toBe(code);
        }
    });

    it("ignores an unsupported saved value", () => {
        expect(isUiLanguage("xx")).toBe(false);
        expect(isUiLanguage(null)).toBe(false);
        expect(
            resolveInitialUiLanguage({saved: "xx", appDefault: "es"}),
        ).toBe("es");
    });

    // --- navigator.language fallback (no-saved-value path) ---------------
    // The fallback chain is saved -> navigator.language -> app default ->
    // "de". It is NEVER a language-list index (that would resolve to English
    // at position 0, never Greek). The architect's German browser therefore
    // yields German, never Greek, on a fresh install.
    it("follows the browser locale when nothing is saved", () => {
        expect(
            resolveInitialUiLanguage({saved: null, browserLocale: "fr-FR"}),
        ).toBe("fr");
    });

    it("normalises a region-tagged browser locale to its base subtag", () => {
        // A German browser (de-DE / de-AT) resolves to "de", never Greek.
        expect(resolveInitialUiLanguage({browserLocale: "de-DE"})).toBe("de");
        expect(resolveInitialUiLanguage({browserLocale: "de-AT"})).toBe("de");
        // A Greek browser legitimately resolves to Greek — that is a real
        // signal, not the reported bug.
        expect(resolveInitialUiLanguage({browserLocale: "el-GR"})).toBe("el");
    });

    it("prefers the saved choice over the browser locale", () => {
        expect(
            resolveInitialUiLanguage({saved: "el", browserLocale: "de-DE"}),
        ).toBe("el");
    });

    it("prefers the browser locale over the app default", () => {
        // The per-person browser locale beats a config default (the prompt's
        // ordering: saved -> navigator -> project default).
        expect(
            resolveInitialUiLanguage({
                saved: null,
                browserLocale: "fr-FR",
                appDefault: "de",
            }),
        ).toBe("fr");
    });

    it("ignores an unsupported browser locale and falls through", () => {
        expect(
            resolveInitialUiLanguage({
                saved: null,
                browserLocale: "sv-SE",
                appDefault: "es",
            }),
        ).toBe("es");
        // Nothing resolvable at all -> the "de" project default, not a list index.
        expect(resolveInitialUiLanguage({browserLocale: "sv-SE"})).toBe("de");
    });

    it("is a pure, idempotent resolver (repeat calls do not drift)", () => {
        const inputs = {saved: null, browserLocale: "fr-FR", appDefault: "de"};
        expect(resolveInitialUiLanguage(inputs)).toBe(
            resolveInitialUiLanguage(inputs),
        );
    });
});

describe("readSavedLang — no silent data loss on an unreadable value (#language-reset)", () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("warns (does not silently drop) when the stored value is not a UI language", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        localStorage.setItem("adaptive-learner.language", "xx");
        expect(readSavedLang()).toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain("xx");
    });

    it("does not warn when nothing is stored (fresh install is normal)", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(readSavedLang()).toBeNull();
        expect(warn).not.toHaveBeenCalled();
    });

    it("never rewrites a valid saved preference (read is side-effect-free)", () => {
        // Regression pin for principle: an update must NEVER overwrite a
        // valid saved UI language. Reading it leaves the stored value intact.
        localStorage.setItem("adaptive-learner.language", "el");
        expect(readSavedLang()).toBe("el");
        expect(localStorage.getItem("adaptive-learner.language")).toBe("el");
    });
});

describe("readSavedLang — the persisted localStorage read seam (#1333)", () => {
    afterEach(() => localStorage.clear());

    it("reads a valid stored UI language (Greek survives the update)", () => {
        localStorage.setItem("adaptive-learner.language", "el");
        expect(readSavedLang()).toBe("el");
    });

    it("returns null when nothing is stored (fresh install)", () => {
        expect(readSavedLang()).toBeNull();
    });

    it("returns null for a stored value that is not a shipped UI language", () => {
        localStorage.setItem("adaptive-learner.language", "xx");
        expect(readSavedLang()).toBeNull();
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

    beforeEach(() => {
        localStorage.clear();
        // Pin the mount default to "de" (#1457 added a navigator.language
        // fallback for the no-saved-value path; happy-dom's default
        // "en-US" would otherwise make the mount resolve to "en" and turn a
        // later "to-en" click into a no-op). These tests exercise the
        // Discover-filter reset, not the default-language resolution.
        vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
    });
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

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
