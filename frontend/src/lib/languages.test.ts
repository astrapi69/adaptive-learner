/**
 * Pins for the UI-language registry (I18N-04 + Hindi I18N-05).
 */

import {describe, it, expect} from "vitest";

import {UI_LANGUAGES, buildLanguageOptions} from "./languages";

describe("UI_LANGUAGES", () => {
    it("registers Hindi with the Devanagari script", () => {
        const hi = UI_LANGUAGES.find((l) => l.code === "hi");
        expect(hi).toBeDefined();
        expect(hi!.nativeName).toBe("हिन्दी");
        expect(hi!.script).toBe("devanagari");
    });

    it("has unique codes and a native name for every entry", () => {
        const codes = UI_LANGUAGES.map((l) => l.code);
        expect(new Set(codes).size).toBe(codes.length);
        for (const l of UI_LANGUAGES) {
            expect(l.nativeName.trim().length).toBeGreaterThan(0);
        }
    });
});

describe("buildLanguageOptions", () => {
    it("localizes each name + script group via t and includes Hindi", () => {
        const t = (key: string, fallback?: string) =>
            key === "languages.hi"
                ? "Hindi"
                : key === "languages.script.devanagari"
                  ? "Devanagari"
                  : (fallback ?? key);
        const opts = buildLanguageOptions(t);
        const hi = opts.find((o) => o.value === "hi");
        expect(hi).toEqual({
            value: "hi",
            nativeLabel: "हिन्दी",
            localizedLabel: "Hindi",
            group: "Devanagari",
        });
    });
});
