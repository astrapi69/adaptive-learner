/**
 * shortcuts/catalog tests (#585).
 *
 * Pins the platform-aware modifier tokens and the group structure used
 * by the help overlay.
 */

import {describe, expect, it} from "vitest";

import {altKey, buildShortcutGroups, modKey} from "./catalog";

const t = (_key: string, fallback?: string) => fallback ?? _key;

describe("modifier tokens", () => {
    it("renders Ctrl/Alt off macOS and ⌘/⌥ on macOS", () => {
        expect(modKey(false)).toBe("Ctrl");
        expect(altKey(false)).toBe("Alt");
        expect(modKey(true)).toBe("⌘");
        expect(altKey(true)).toBe("⌥");
    });
});

describe("buildShortcutGroups", () => {
    it("groups global / navigation / lesson with platform mod keys", () => {
        const groups = buildShortcutGroups(t, false);
        expect(groups.map((g) => g.label)).toEqual([
            "Global",
            "Navigation",
            "During a lesson",
        ]);
        const settings = groups[0].items.find(
            (i) => i.description === "Open settings",
        )!;
        expect(settings.keys).toEqual(["Ctrl", ","]);
        const nav = groups[1].items.find(
            (i) => i.description === "Go to dashboard",
        )!;
        expect(nav.keys).toEqual(["Alt", "D"]);
    });

    it("uses macOS glyphs when isMac", () => {
        const groups = buildShortcutGroups(t, true);
        const settings = groups[0].items.find(
            (i) => i.description === "Open settings",
        )!;
        expect(settings.keys).toEqual(["⌘", ","]);
    });
});
