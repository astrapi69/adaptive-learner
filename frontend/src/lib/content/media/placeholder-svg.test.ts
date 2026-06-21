/**
 * Tests for the inline-SVG placeholder generator
 * (Phase 54D / v1.37.0).
 */

import {describe, expect, it} from "vitest";

import {detectCategory, generatePlaceholderSvg} from "./placeholder-svg";

function decode(dataUri: string): string {
    const prefix = "data:image/svg+xml;utf8,";
    expect(dataUri.startsWith(prefix)).toBe(true);
    return decodeURIComponent(dataUri.slice(prefix.length));
}

describe("detectCategory", () => {
    it.each([
        ["red", "color"],
        ["RED", "color"],
        ["rouge", "color"],
        ["rojo", "color"],
        ["rot", "color"],
        ["weiß", "color"],
        ["grün", "color"],
        ["marrón", "color"],
    ] as const)("recognises color word %s → %s", (label, expected) => {
        expect(detectCategory(label)).toBe(expected);
    });

    it.each([
        ["0", "number"],
        ["7", "number"],
        ["1492", "number"],
    ] as const)("recognises number %s → %s", (label, expected) => {
        expect(detectCategory(label)).toBe(expected);
    });

    it.each([
        ["bonjour", "default"],
        ["cat", "default"],
        ["chien", "default"],
        ["", "default"],
        ["   ", "default"],
    ] as const)(
        "falls through to default for %s → %s",
        (label, expected) => {
            expect(detectCategory(label)).toBe(expected);
        },
    );

    it("does NOT classify a numeric-looking word like '3rd' as number", () => {
        // The regex is anchored — only pure-digit strings
        // qualify. "3rd" falls through to default.
        expect(detectCategory("3rd")).toBe("default");
    });
});

describe("generatePlaceholderSvg — color swatch", () => {
    it("renders a hex-filled rect for a known color", () => {
        const uri = generatePlaceholderSvg("red");
        const svg = decode(uri);
        expect(svg).toContain('fill="#e63946"');
        expect(svg).toContain("<rect");
    });

    it("uses a neutral fill for an unknown color label", () => {
        // ``detectCategory`` rejects unknown colors, but the
        // explicit category="color" path is still defensive.
        const uri = generatePlaceholderSvg("plaid", "color");
        const svg = decode(uri);
        // Falls back to #9ca3af (gray).
        expect(svg).toContain('fill="#9ca3af"');
    });

    it("multilingual aliases map to the same hex", () => {
        const en = decode(generatePlaceholderSvg("red"));
        const fr = decode(generatePlaceholderSvg("rouge"));
        const es = decode(generatePlaceholderSvg("rojo"));
        const de = decode(generatePlaceholderSvg("rot"));
        const hexMatch = /fill="(#[a-f0-9]{6})"/.exec(en);
        expect(hexMatch).not.toBeNull();
        const hex = hexMatch![1];
        expect(fr).toContain(`fill="${hex}"`);
        expect(es).toContain(`fill="${hex}"`);
        expect(de).toContain(`fill="${hex}"`);
    });
});

describe("generatePlaceholderSvg — number", () => {
    it("renders the digits centered as text", () => {
        const svg = decode(generatePlaceholderSvg("7"));
        expect(svg).toContain("<text");
        expect(svg).toContain(">7</text>");
    });

    it("clips long numerals to 4 chars to fit the bbox", () => {
        const svg = decode(generatePlaceholderSvg("12345"));
        expect(svg).toContain(">1234</text>");
    });
});

describe("generatePlaceholderSvg — default avatar", () => {
    it("renders a colored circle with the first letter", () => {
        const svg = decode(generatePlaceholderSvg("bonjour"));
        expect(svg).toContain("<circle");
        expect(svg).toContain(">B</text>");
    });

    it("'?' is the avatar letter when label is empty / whitespace", () => {
        const svg = decode(generatePlaceholderSvg("   ", "default"));
        expect(svg).toContain(">?</text>");
    });

    it("same label → same avatar color (deterministic hash)", () => {
        const a = decode(generatePlaceholderSvg("bonjour"));
        const b = decode(generatePlaceholderSvg("bonjour"));
        expect(a).toBe(b);
    });

    it("different labels produce different colors most of the time", () => {
        const labels = ["alpha", "beta", "gamma", "delta", "epsilon"];
        const colors = new Set<string>();
        for (const label of labels) {
            const svg = decode(generatePlaceholderSvg(label));
            const hex = /<circle [^>]*fill="(#[a-f0-9]{6})"/.exec(svg)?.[1];
            if (hex) colors.add(hex);
        }
        // Not strict — 5 distinct labels could collide on
        // 12 palette slots ~9.5% per pair, so we accept
        // ≥ 3 distinct colors as evidence of dispersion.
        expect(colors.size).toBeGreaterThanOrEqual(3);
    });
});

describe("generatePlaceholderSvg — output integrity", () => {
    it("is a valid data: URI", () => {
        const uri = generatePlaceholderSvg("Cat");
        expect(uri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    });

    it("escapes <, >, & in the label", () => {
        const svg = decode(generatePlaceholderSvg("a<b&c>", "default"));
        // We took the first letter ("a"); the escape path
        // matters more for the number / placeholder branches
        // that render the full label, but the helper applies
        // unconditionally.
        expect(svg).toContain(">A</text>");
        expect(svg).not.toContain("<b&c>");
    });

    it("same inputs produce byte-identical bytes", () => {
        const a = generatePlaceholderSvg("Cat", "default");
        const b = generatePlaceholderSvg("Cat", "default");
        expect(a).toBe(b);
    });

    it("explicit category overrides auto-detection", () => {
        // "red" would auto-detect to "color" — force avatar.
        const auto = decode(generatePlaceholderSvg("red"));
        const forced = decode(generatePlaceholderSvg("red", "default"));
        expect(auto).toContain("<rect");
        expect(forced).toContain("<circle");
    });
});
