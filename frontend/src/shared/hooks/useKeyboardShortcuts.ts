/**
 * useKeyboardShortcuts — a small, app-agnostic keyboard-shortcut
 * registry hook. A caller passes a list of {@link ShortcutDefinition}s;
 * the hook attaches one ``keydown`` listener, matches the event against
 * each definition (key + modifiers), and invokes the first match.
 *
 * Props-driven and self-contained: actions are caller callbacks, every
 * label is supplied by the caller, and nothing app-specific is imported
 * (no i18n, router, or storage). Reusable in any React app that needs
 * declarative shortcuts.
 *
 * Behaviour:
 *   - Shortcuts are skipped while an editable element (``input`` /
 *     ``textarea`` / ``select`` / ``contenteditable``) is focused,
 *     unless the definition sets ``allowInInput``. This keeps typing
 *     from triggering navigation.
 *   - ``ctrlOrMeta`` matches Ctrl on Windows/Linux and ⌘ on macOS, so a
 *     single definition covers both platforms.
 *   - ``modifiers`` are matched exactly for alt + ctrlOrMeta; ``shift``
 *     is only constrained when explicitly set (so ``"?"`` — which needs
 *     Shift on most layouts — still matches).
 *   - The first matching definition wins; it ``preventDefault``s unless
 *     ``preventDefault: false``.
 *
 * In development, duplicate key combos in the same context are reported
 * via {@link detectShortcutConflicts} as a ``console.warn`` so an
 * accidental clash surfaces early.
 *
 * @example
 * useKeyboardShortcuts([
 *   {id: "help", key: "?", context: "global", description: "Show shortcuts",
 *    action: () => setHelpOpen(true)},
 *   {id: "nav-dashboard", key: "d", modifiers: {alt: true}, context: "navigation",
 *    description: "Go to dashboard", action: () => navigate("/dashboard")},
 * ]);
 */

import {useEffect, useRef} from "react";

export interface ShortcutModifiers {
    /** Requires Ctrl (Win/Linux) or ⌘ (macOS). */
    ctrlOrMeta?: boolean;
    /** Requires the Alt/Option key. */
    alt?: boolean;
    /** When set, constrains the Shift key exactly; when omitted, Shift
     *  is ignored (so layout-dependent keys like ``"?"`` still match). */
    shift?: boolean;
}

export interface ShortcutDefinition {
    /** Stable identifier (used for conflict reporting + React keys). */
    id: string;
    /** ``KeyboardEvent.key`` to match. Single letters are matched
     *  case-insensitively; other keys (``"?"``, ``","``, ``"Escape"``)
     *  match literally. */
    key: string;
    modifiers?: ShortcutModifiers;
    /** Invoked when the shortcut matches. */
    action: (event: KeyboardEvent) => void;
    /** Human-readable description (for a help overlay). */
    description: string;
    /** Grouping label, e.g. ``"global"`` / ``"navigation"`` / ``"lesson"``. */
    context?: string;
    /** Fire even when an editable element is focused. Default false. */
    allowInInput?: boolean;
    /** Call ``preventDefault`` on a match. Default true. */
    preventDefault?: boolean;
}

export interface UseKeyboardShortcutsOptions {
    /** Master switch; when false the listener is not attached. */
    enabled?: boolean;
}

/** True when the element would consume normal typing input. */
export function isEditableTarget(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return el.isContentEditable;
}

function keyMatches(defKey: string, eventKey: string): boolean {
    if (defKey.length === 1 && eventKey.length === 1) {
        return defKey.toLowerCase() === eventKey.toLowerCase();
    }
    return defKey === eventKey;
}

function modifiersMatch(
    mods: ShortcutModifiers | undefined,
    event: KeyboardEvent,
): boolean {
    const wantCtrlOrMeta = mods?.ctrlOrMeta ?? false;
    const hasCtrlOrMeta = event.ctrlKey || event.metaKey;
    if (wantCtrlOrMeta !== hasCtrlOrMeta) return false;
    const wantAlt = mods?.alt ?? false;
    if (wantAlt !== event.altKey) return false;
    if (typeof mods?.shift === "boolean" && mods.shift !== event.shiftKey) {
        return false;
    }
    return true;
}

/** A signature string for a shortcut's trigger (key + modifiers). */
function triggerSignature(def: ShortcutDefinition): string {
    const m = def.modifiers ?? {};
    const parts = [
        m.ctrlOrMeta ? "mod" : "",
        m.alt ? "alt" : "",
        m.shift ? "shift" : "",
        def.key.toLowerCase(),
    ].filter(Boolean);
    return `${def.context ?? "global"}:${parts.join("+")}`;
}

/**
 * Find shortcuts that share the same trigger within the same context.
 * Returns a map of signature → conflicting ids (only entries with > 1
 * id). Pure; used by the hook for a dev-time warning and unit-testable
 * on its own.
 */
export function detectShortcutConflicts(
    shortcuts: readonly ShortcutDefinition[],
): Record<string, string[]> {
    const bySig: Record<string, string[]> = {};
    for (const def of shortcuts) {
        const sig = triggerSignature(def);
        (bySig[sig] ??= []).push(def.id);
    }
    const conflicts: Record<string, string[]> = {};
    for (const [sig, ids] of Object.entries(bySig)) {
        if (ids.length > 1) conflicts[sig] = ids;
    }
    return conflicts;
}

/** Register declarative keyboard shortcuts for the component's lifetime. */
export function useKeyboardShortcuts(
    shortcuts: readonly ShortcutDefinition[],
    options: UseKeyboardShortcutsOptions = {},
): void {
    const {enabled = true} = options;
    const ref = useRef(shortcuts);
    ref.current = shortcuts;

    useEffect(() => {
        if (import.meta.env?.DEV) {
            const conflicts = detectShortcutConflicts(shortcuts);
            if (Object.keys(conflicts).length > 0) {
                console.warn(
                    "useKeyboardShortcuts: conflicting shortcuts",
                    conflicts,
                );
            }
        }
    }, [shortcuts]);

    useEffect(() => {
        if (!enabled) return;
        function onKey(event: KeyboardEvent) {
            if (event.defaultPrevented) return;
            const editable = isEditableTarget(event.target);
            for (const def of ref.current) {
                if (editable && !def.allowInInput) continue;
                if (!keyMatches(def.key, event.key)) continue;
                if (!modifiersMatch(def.modifiers, event)) continue;
                if (def.preventDefault !== false) event.preventDefault();
                def.action(event);
                return;
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [enabled]);
}
