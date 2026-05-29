/**
 * Phase 58D/58E — theme registry.
 *
 * One-dimensional theme model: each entry is a self-contained
 * ``data-theme`` value with the FULL canonical token set defined in
 * styles/themes/theme-<id>.css. ``auto`` is not a theme — it follows
 * the OS ``prefers-color-scheme`` and resolves to ``light`` or
 * ``dark`` (see resolveTheme).
 *
 * Labels here are English fallbacks; Settings renders them through
 * ``t("ui.themes.<id>", fallback)`` so the YAML catalogs are the
 * localized source of truth.
 */

export type ThemeId =
    | "light"
    | "dark"
    | "ocean"
    | "forest"
    | "high-contrast"
    | "sepia";

/** The user's selectable choice: a concrete theme or OS-follow. */
export type ThemeChoice = ThemeId | "auto";

export interface ThemeMeta {
    id: ThemeId;
    /** English fallback label (i18n key is ``ui.themes.<id>``). */
    label: string;
    /** Whether the theme is light- or dark-family (used for grouping). */
    family: "light" | "dark";
    /** Representative colors for the Settings preview card. */
    swatch: {
        bg: string;
        surface: string;
        accent: string;
        fg: string;
    };
}

export const THEMES: readonly ThemeMeta[] = [
    {
        id: "light",
        label: "Light",
        family: "light",
        swatch: {bg: "#ffffff", surface: "#f8fafc", accent: "#4f46e5", fg: "#1a1a1a"},
    },
    {
        id: "dark",
        label: "Dark",
        family: "dark",
        swatch: {bg: "#0f0f10", surface: "#1c1c20", accent: "#818cf8", fg: "#ececec"},
    },
    {
        id: "ocean",
        label: "Ocean",
        family: "dark",
        swatch: {bg: "#0b1f33", surface: "#123150", accent: "#38bdf8", fg: "#e6f0fa"},
    },
    {
        id: "forest",
        label: "Forest",
        family: "dark",
        swatch: {bg: "#14201a", surface: "#1f322a", accent: "#e0a458", fg: "#eef3ec"},
    },
    {
        id: "high-contrast",
        label: "High Contrast",
        family: "dark",
        swatch: {bg: "#000000", surface: "#0a0a0a", accent: "#ffff00", fg: "#ffffff"},
    },
    {
        id: "sepia",
        label: "Sepia",
        family: "light",
        swatch: {bg: "#f4ecd8", surface: "#faf3e0", accent: "#9a5b2d", fg: "#3b2f1e"},
    },
];

export const THEME_IDS: readonly ThemeId[] = THEMES.map((meta) => meta.id);

export const DEFAULT_THEME: ThemeId = "light";

export function isKnownTheme(value: string): value is ThemeId {
    return THEMES.some((meta) => meta.id === value);
}

export function isThemeChoice(value: string): value is ThemeChoice {
    return value === "auto" || isKnownTheme(value);
}

/**
 * Resolve a user choice to the concrete ``data-theme`` value to apply.
 * ``auto`` maps to ``dark`` when the OS prefers dark, else ``light``.
 */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ThemeId {
    if (choice === "auto") return prefersDark ? "dark" : "light";
    return choice;
}
