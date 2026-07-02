import {afterEach, describe, it, expect} from "vitest";

import {isUiLanguage, readSavedLang, resolveInitialUiLanguage} from "./useI18n";

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

    it("falls back to the browser locale when no saved choice or app default", () => {
        expect(
            resolveInitialUiLanguage({navigatorLang: "el-GR"}),
        ).toBe("el");
        expect(
            resolveInitialUiLanguage({navigatorLang: "pt-BR"}),
        ).toBe("pt");
    });

    it("defaults to 'de' when nothing resolves", () => {
        expect(resolveInitialUiLanguage({})).toBe("de");
        expect(
            resolveInitialUiLanguage({saved: "xx", navigatorLang: "zz-ZZ"}),
        ).toBe("de");
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
