/**
 * shortcuts/catalog — the app's display catalogue of keyboard
 * shortcuts, grouped by context for the help overlay.
 *
 * This is the single source of truth for what the help dialog SHOWS. It
 * documents every shortcut, including ones whose active handler lives
 * elsewhere (the lesson Enter shortcut, the Cmd/Ctrl+K content search,
 * the per-renderer lesson keys), so the overlay stays complete even
 * though the handlers are distributed.
 *
 * Pure + side-effect-free: it takes the i18n ``t`` resolver and a
 * platform flag and returns {@link ShortcutHelpGroup}s, so it is
 * unit-testable without a DOM.
 */

import type {ShortcutHelpGroup} from "../../shared/ShortcutHelpDialog";

export type Translate = (key: string, fallback?: string) => string;

/** True on macOS (so combos render ⌘/⌥ instead of Ctrl/Alt). */
export function isMacPlatform(): boolean {
    if (typeof navigator === "undefined") return false;
    const probe = `${navigator.platform} ${navigator.userAgent}`;
    return /mac|iphone|ipad|ipod/i.test(probe);
}

/** The display token for the Ctrl/⌘ modifier. */
export function modKey(isMac: boolean): string {
    return isMac ? "⌘" : "Ctrl";
}

/** The display token for the Alt/⌥ modifier. */
export function altKey(isMac: boolean): string {
    return isMac ? "⌥" : "Alt";
}

/**
 * Build the grouped shortcut catalogue for the help overlay.
 */
export function buildShortcutGroups(
    t: Translate,
    isMac: boolean,
): ShortcutHelpGroup[] {
    const mod = modKey(isMac);
    const alt = altKey(isMac);
    return [
        {
            label: t("shortcuts.group_global", "Global"),
            items: [
                {
                    keys: ["?"],
                    description: t(
                        "shortcuts.show_help",
                        "Show keyboard shortcuts",
                    ),
                },
                {
                    keys: [mod, ","],
                    description: t("shortcuts.open_settings", "Open settings"),
                },
                {
                    keys: [mod, "K"],
                    description: t(
                        "shortcuts.search_content",
                        "Search content",
                    ),
                },
                {
                    keys: ["Esc"],
                    description: t("shortcuts.close_dialog", "Close dialog"),
                },
            ],
        },
        {
            label: t("shortcuts.group_navigation", "Navigation"),
            items: [
                {
                    keys: [alt, "D"],
                    description: t("shortcuts.go_dashboard", "Go to dashboard"),
                },
                {
                    keys: [alt, "S"],
                    description: t("shortcuts.go_settings", "Go to settings"),
                },
                {
                    keys: [alt, "C"],
                    description: t("shortcuts.go_content", "Go to content"),
                },
                {
                    keys: [alt, "P"],
                    description: t(
                        "shortcuts.go_statistics",
                        "Go to statistics",
                    ),
                },
            ],
        },
        {
            label: t("shortcuts.group_lesson", "During a lesson"),
            items: [
                {
                    keys: ["Enter"],
                    description: t(
                        "shortcuts.lesson_enter",
                        "Check answer, then continue",
                    ),
                },
                {
                    keys: ["1", "–", "4"],
                    description: t(
                        "shortcuts.lesson_choice",
                        "Select an answer option",
                    ),
                },
                {
                    keys: [mod, "Z"],
                    description: t(
                        "shortcuts.lesson_undo_match",
                        "Undo the last match",
                    ),
                },
            ],
        },
    ];
}
