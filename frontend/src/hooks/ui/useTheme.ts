import {useCallback, useEffect, useState} from "react";

import {
    DEFAULT_THEME_CHOICE,
    isThemeChoice,
    resolveTheme,
    THEMES,
    type ThemeChoice,
    type ThemeId,
} from "../../lib/theme/themes";

/**
 * Phase 58E — theme hook for the 6-theme + auto model.
 *
 * Persists the user's CHOICE (a concrete theme or ``auto``) under
 * ``adaptive-learner.theme`` (the dotted project convention). When
 * ``auto``, the resolved theme follows the OS ``prefers-color-scheme``
 * live. The applied ``data-theme`` attribute is the RESOLVED theme.
 *
 * The pre-paint script in index.html applies the same resolution
 * before React mounts (no flash); this hook keeps it in sync after.
 */

const STORAGE_KEY = "adaptive-learner.theme";
const LEGACY_KEY = "adaptive-learner-theme";

function getInitialChoice(): ThemeChoice {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isThemeChoice(stored)) return stored;
    // One-time migration from the pre-58E hyphen key so existing users
    // keep their saved light/dark preference.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy && isThemeChoice(legacy)) {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_KEY);
        return legacy;
    }
    // No stored preference -> the Soft Pop default (new users). Existing
    // users are handled by the stored-choice + legacy-migration paths above,
    // so their saved choice always wins over this default.
    return DEFAULT_THEME_CHOICE;
}

function systemPrefersDark(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
}

export function useTheme() {
    const [choice, setChoiceState] = useState<ThemeChoice>(getInitialChoice);
    const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

    // Track OS scheme changes (only affects the resolved theme while
    // the choice is ``auto``, but cheap to always listen).
    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (event: MediaQueryListEvent) => setSystemDark(event.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    const resolved: ThemeId = resolveTheme(choice, systemDark);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", resolved);
    }, [resolved]);

    const setChoice = useCallback((next: ThemeChoice) => {
        setChoiceState(next);
        localStorage.setItem(STORAGE_KEY, next);
    }, []);

    // Quick light/dark flip for the nav button: jump to the opposite
    // family of whatever is currently showing.
    const toggle = useCallback(() => {
        const family = THEMES.find((meta) => meta.id === resolved)?.family ?? "light";
        setChoice(family === "dark" ? "light" : "dark");
    }, [resolved, setChoice]);

    return {theme: resolved, choice, setChoice, toggle};
}
