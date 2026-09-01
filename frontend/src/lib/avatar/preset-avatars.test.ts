/**
 * Tests for the preset avatar catalogue (#2848): shape of the
 * registry, deterministic + well-formed data URLs, and the size
 * bound that keeps every preset comfortably below the avatar
 * byte cap and the backend column limit.
 */

import {describe, expect, it} from "vitest";

import {AVATAR_MAX_BYTES} from "./resize-image";
import {
    PRESET_AVATARS,
    presetAvatarDataUrl,
} from "./preset-avatars";

describe("PRESET_AVATARS registry", () => {
    it("offers 8 figures with unique ids", () => {
        expect(PRESET_AVATARS.length).toBe(8);
        const ids = PRESET_AVATARS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it.each(PRESET_AVATARS.map((p) => [p.id] as const))(
        "preset %s produces a well-formed utf8 SVG data URL",
        (id) => {
            const url = presetAvatarDataUrl(id);
            expect(url.startsWith("data:image/svg+xml;utf8,")).toBe(true);
            const svg = decodeURIComponent(
                url.slice("data:image/svg+xml;utf8,".length),
            );
            expect(svg).toContain("<svg");
            expect(svg).toContain("viewBox");
            expect(svg).toContain("</svg>");
        },
    );

    it("data URLs are deterministic (same id, same bytes)", () => {
        for (const p of PRESET_AVATARS) {
            expect(presetAvatarDataUrl(p.id)).toBe(presetAvatarDataUrl(p.id));
        }
    });

    it("every preset stays far below the avatar byte cap", () => {
        for (const p of PRESET_AVATARS) {
            expect(presetAvatarDataUrl(p.id).length).toBeLessThan(
                AVATAR_MAX_BYTES / 4,
            );
        }
    });

    it("presets are pairwise distinct images", () => {
        const urls = PRESET_AVATARS.map((p) => presetAvatarDataUrl(p.id));
        expect(new Set(urls).size).toBe(urls.length);
    });

    it("an unknown id throws instead of rendering a broken image", () => {
        expect(() => presetAvatarDataUrl("nope")).toThrow();
    });
});
