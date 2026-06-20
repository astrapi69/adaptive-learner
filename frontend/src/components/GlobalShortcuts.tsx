/**
 * GlobalShortcuts — mounts the app-wide keyboard shortcuts and the
 * help overlay. Rendered once near the App root.
 *
 * Registers the active handlers for the global + navigation shortcuts
 * (``?`` toggles the help overlay, ``Ctrl/⌘ + ,`` opens Settings, and
 * ``Alt + D/S/C/P`` jump to Dashboard / Settings / Content / Statistics)
 * via the reusable {@link useKeyboardShortcuts} hook, and renders the
 * {@link ShortcutHelpDialog} from the display {@link buildShortcutGroups}
 * catalogue.
 *
 * It deliberately does NOT re-register the shortcuts whose handlers
 * already live with their feature (the lesson ``Enter`` shortcut, the
 * ``Cmd/Ctrl+K`` content search, the per-renderer lesson keys) — those
 * stay where they are; the catalogue only DOCUMENTS them so the overlay
 * is complete. ``Escape`` is registered only while the overlay is open,
 * so it never competes with the Escape handling of other dialogs.
 */

import {useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";

import ShortcutHelpDialog from "../shared/feedback/ShortcutHelpDialog";
import {
    useKeyboardShortcuts,
    type ShortcutDefinition,
} from "../shared/hooks/useKeyboardShortcuts";
import {buildShortcutGroups, isMacPlatform} from "../lib/shortcuts/catalog";
import {useI18n} from "../hooks/ui/useI18n";

export default function GlobalShortcuts() {
    const {t} = useI18n();
    const navigate = useNavigate();
    const [helpOpen, setHelpOpen] = useState(false);
    const isMac = useMemo(() => isMacPlatform(), []);

    const shortcuts = useMemo<ShortcutDefinition[]>(() => {
        const list: ShortcutDefinition[] = [
            {
                id: "help-toggle",
                key: "?",
                context: "global",
                description: "Show keyboard shortcuts",
                action: () => setHelpOpen((open) => !open),
            },
            {
                id: "open-settings",
                key: ",",
                modifiers: {ctrlOrMeta: true},
                context: "global",
                description: "Open settings",
                action: () => navigate("/settings"),
            },
            {
                id: "nav-dashboard",
                key: "d",
                modifiers: {alt: true},
                context: "navigation",
                description: "Go to dashboard",
                action: () => navigate("/dashboard"),
            },
            {
                id: "nav-settings",
                key: "s",
                modifiers: {alt: true},
                context: "navigation",
                description: "Go to settings",
                action: () => navigate("/settings"),
            },
            {
                id: "nav-content",
                key: "c",
                modifiers: {alt: true},
                context: "navigation",
                description: "Go to content",
                action: () => navigate("/content?tab=my"),
            },
            {
                id: "nav-progress",
                key: "p",
                modifiers: {alt: true},
                context: "navigation",
                description: "Go to progress",
                action: () => navigate("/progress"),
            },
        ];
        if (helpOpen) {
            list.push({
                id: "help-close",
                key: "Escape",
                context: "global",
                description: "Close shortcut help",
                allowInInput: true,
                action: () => setHelpOpen(false),
            });
        }
        return list;
    }, [navigate, helpOpen]);

    useKeyboardShortcuts(shortcuts);

    const groups = useMemo(() => buildShortcutGroups(t, isMac), [t, isMac]);

    return (
        <ShortcutHelpDialog
            open={helpOpen}
            onClose={() => setHelpOpen(false)}
            title={t("shortcuts.title", "Keyboard shortcuts")}
            closeLabel={t("common.close", "Close")}
            groups={groups}
            testId="shortcut-help"
        />
    );
}
