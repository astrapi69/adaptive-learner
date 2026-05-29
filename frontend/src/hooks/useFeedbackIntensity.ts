/**
 * useFeedbackIntensity (EXP-008 / Phase 55).
 *
 * Returns the EFFECTIVE feedback intensity - the stored level,
 * clamped to "subtle" whenever the user requests reduced motion.
 * Re-reads live when the preference changes in this tab (via the
 * ``FEEDBACK_PREF_CHANGE_EVENT``), in another tab (native
 * ``storage`` event), or when the OS reduced-motion setting
 * flips.
 *
 * All celebration components read intensity through this hook so
 * the Settings control takes effect without a reload.
 */

import {useEffect, useState} from "react";

import {
    effectiveIntensity,
    FEEDBACK_PREF_CHANGE_EVENT,
    type FeedbackIntensity,
} from "../lib/feedback/feedbackPref";

export function useFeedbackIntensity(): FeedbackIntensity {
    const [intensity, setIntensity] = useState<FeedbackIntensity>(() =>
        effectiveIntensity(),
    );

    useEffect(() => {
        const refresh = () => setIntensity(effectiveIntensity());

        window.addEventListener(FEEDBACK_PREF_CHANGE_EVENT, refresh);
        window.addEventListener("storage", refresh);

        let media: MediaQueryList | null = null;
        if (typeof window.matchMedia === "function") {
            media = window.matchMedia("(prefers-reduced-motion: reduce)");
            // Safari < 14 only supports addListener.
            if (typeof media.addEventListener === "function") {
                media.addEventListener("change", refresh);
            } else if (typeof media.addListener === "function") {
                media.addListener(refresh);
            }
        }

        // Pick up any change that happened between the initial
        // useState and the effect mount.
        refresh();

        return () => {
            window.removeEventListener(FEEDBACK_PREF_CHANGE_EVENT, refresh);
            window.removeEventListener("storage", refresh);
            if (media) {
                if (typeof media.removeEventListener === "function") {
                    media.removeEventListener("change", refresh);
                } else if (typeof media.removeListener === "function") {
                    media.removeListener(refresh);
                }
            }
        };
    }, []);

    return intensity;
}
