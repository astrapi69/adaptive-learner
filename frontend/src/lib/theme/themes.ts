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
    | "sepia"
    | "catppuccin-latte"
    | "supabase"
    | "graphite"
    | "catppuccin-mocha"
    | "soft-pop"
    | "amethyst-haze";

/** The user's selectable choice: a concrete theme or OS-follow. */
export type ThemeChoice = ThemeId | "auto";

export interface ThemeMeta {
    id: ThemeId;
    /** English fallback label (i18n key is ``ui.themes.<id>``). */
    label: string;
    /** Whether the theme is light- or dark-family (used for grouping). */
    family: "light" | "dark";
    /**
     * Settings sub-tab grouping. ``recommended`` are the WCAG-AA-verified
     * open-source shadcn presets (default tab); ``classic`` are the
     * original hand-built themes, kept so nobody's active choice breaks.
     */
    group: "recommended" | "classic";
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
        id: "catppuccin-latte",
        label: "Catppuccin Latte",
        family: "light",
        group: "recommended",
        swatch: {bg: "#eff1f5", surface: "#ffffff", accent: "#8839ef", fg: "#4c4f69"},
    },
    {
        id: "supabase",
        label: "Supabase",
        family: "light",
        group: "recommended",
        swatch: {bg: "#fcfcfc", surface: "#fcfcfc", accent: "#72e3ad", fg: "#171717"},
    },
    {
        id: "graphite",
        label: "Graphite",
        family: "light",
        group: "recommended",
        swatch: {bg: "#f0f0f0", surface: "#f5f5f5", accent: "#606060", fg: "#333333"},
    },
    {
        id: "catppuccin-mocha",
        label: "Catppuccin Mocha",
        family: "dark",
        group: "recommended",
        swatch: {bg: "#181825", surface: "#1e1e2e", accent: "#cba6f7", fg: "#cdd6f4"},
    },
    {
        id: "soft-pop",
        label: "Soft Pop",
        family: "dark",
        group: "recommended",
        swatch: {bg: "#000000", surface: "#1a212b", accent: "#818cf8", fg: "#ffffff"},
    },
    {
        id: "amethyst-haze",
        label: "Amethyst Haze",
        family: "dark",
        group: "recommended",
        swatch: {bg: "#1a1823", surface: "#232030", accent: "#a995c9", fg: "#e0ddef"},
    },
    {
        id: "light",
        label: "Light",
        family: "light",
        group: "classic",
        swatch: {bg: "#ffffff", surface: "#f8fafc", accent: "#4f46e5", fg: "#1a1a1a"},
    },
    {
        id: "dark",
        label: "Dark",
        family: "dark",
        group: "classic",
        swatch: {bg: "#0f0f10", surface: "#1c1c20", accent: "#818cf8", fg: "#ececec"},
    },
    {
        id: "ocean",
        label: "Ocean",
        family: "dark",
        group: "classic",
        swatch: {bg: "#0b1f33", surface: "#123150", accent: "#38bdf8", fg: "#e6f0fa"},
    },
    {
        id: "forest",
        label: "Forest",
        family: "dark",
        group: "classic",
        swatch: {bg: "#14201a", surface: "#1f322a", accent: "#e0a458", fg: "#eef3ec"},
    },
    {
        id: "high-contrast",
        label: "High Contrast",
        family: "dark",
        group: "classic",
        swatch: {bg: "#000000", surface: "#0a0a0a", accent: "#ffff00", fg: "#ffffff"},
    },
    {
        id: "sepia",
        label: "Sepia",
        family: "light",
        group: "classic",
        swatch: {bg: "#f4ecd8", surface: "#faf3e0", accent: "#9a5b2d", fg: "#3b2f1e"},
    },
];

export const THEME_IDS: readonly ThemeId[] = THEMES.map((meta) => meta.id);

/** Type guard: whether ``value`` is a registered concrete theme id. */
export function isKnownTheme(value: string): value is ThemeId {
    return THEMES.some((meta) => meta.id === value);
}

/** Type guard: whether ``value`` is a valid theme choice (a known
 *  theme id or ``"auto"``). */
export function isThemeChoice(value: string): value is ThemeChoice {
    return value === "auto" || isKnownTheme(value);
}

/**
 * Whether a concrete theme is dark-family (dark background surface).
 * Drives the dark icon variant in the nav/landing header so the brand
 * mark keeps WCAG-AA contrast on dark surfaces. Defaults to ``false``
 * for an unknown id (treat as light).
 */
export function isDarkTheme(id: ThemeId): boolean {
    return THEMES.find((meta) => meta.id === id)?.family === "dark";
}

/**
 * Resolve a user choice to the concrete ``data-theme`` value to apply.
 * ``auto`` maps to ``dark`` when the OS prefers dark, else ``light``.
 */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ThemeId {
    if (choice === "auto") return prefersDark ? "dark" : "light";
    return choice;
}
