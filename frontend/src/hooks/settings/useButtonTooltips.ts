/**
 * Button-tooltip preference (Phase 38 accessibility sweep).
 *
 * Returns whether the user has the "Button tooltips" preference
 * ON (default) or OFF. The setting is independent from the
 * help-glossary tooltip (``HelpTooltip`` / glossary terms);
 * this one controls the native ``title`` attribute that
 * surfaces on hover for icon-only and ambiguous-text buttons.
 *
 * ``aria-label`` is intentionally NOT gated by this setting —
 * screen readers and keyboard users always get the accessible
 * name. The toggle only suppresses the visual hover tooltip.
 *
 * Storage: ``localStorage`` under
 * ``adaptive-learner.button_tooltips_enabled``. Default ON.
 *
 * Updates: a custom ``adaptive-learner:button-tooltips-changed``
 * event fires whenever the Settings toggle flips, so every
 * subscribed component re-renders in lockstep.
 */

import {useEffect, useState} from "react";

const STORAGE_KEY = "adaptive-learner.button_tooltips_enabled";
const EVENT_NAME = "adaptive-learner:button-tooltips-changed";

function readPreference(): boolean {
    if (typeof localStorage === "undefined") return true;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return true;
        return raw !== "false";
    } catch {
        return true;
    }
}

/**
 * Hook returning the current "button tooltips enabled" value.
 * Re-renders the consumer when the preference changes via the
 * Settings toggle.
 */
export function useButtonTooltips(): boolean {
    const [enabled, setEnabled] = useState<boolean>(() => readPreference());

    useEffect(() => {
        // Some test environments stub ``window`` without
        // ``addEventListener`` (e.g. the MicButton suite swaps
        // it for a SpeechRecognition stub). Bail out cleanly
        // instead of crashing the host component.
        if (
            typeof window === "undefined" ||
            typeof window.addEventListener !== "function"
        ) {
            return;
        }
        const handler = () => setEnabled(readPreference());
        window.addEventListener(EVENT_NAME, handler);
        // Cross-tab sync via the storage event.
        const storageHandler = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) {
                setEnabled(readPreference());
            }
        };
        window.addEventListener("storage", storageHandler);
        return () => {
            window.removeEventListener(EVENT_NAME, handler);
            window.removeEventListener("storage", storageHandler);
        };
    }, []);

    return enabled;
}

/**
 * Imperative setter for the Settings toggle. Writes the
 * preference + dispatches the change event so subscribers
 * re-render immediately (no full reload required).
 */
export function setButtonTooltipsEnabled(value: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    } catch {
        /* localStorage unavailable — best effort */
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, {detail: {value}}));
}

/**
 * Convenience helper for icon-only buttons. Returns the
 * accessibility-mandatory ``aria-label`` always; returns
 * ``title`` only when the preference is ON.
 *
 * Usage:
 *
 *     const tooltipProps = useTooltipProps(t("ui.tooltips.delete", "Delete"));
 *     <button {...tooltipProps} onClick={...}>
 *         <Trash size={16}/>
 *     </button>
 */
export function useTooltipProps(label: string): {
    "aria-label": string;
    title?: string;
} {
    const enabled = useButtonTooltips();
    return enabled ? {"aria-label": label, title: label} : {"aria-label": label};
}
