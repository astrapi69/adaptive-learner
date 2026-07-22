/**
 * Lesson-summary Enter-key shortcut (#1943).
 *
 * On the end-of-lesson summary screen, ``useLessonEnterKey`` steps
 * aside (``decideLessonEnterAction`` returns ``"none"`` for
 * ``isSummary``) because the summary has its own actions rather than
 * the two-phase Check/Next button. This hook fills that gap: a bare
 * Enter activates the summary's PRIMARY next-step CTA — the one already
 * highlighted with the accent border (``primaryAction`` in
 * ``NextStepSuggestions``), e.g. "Nächste Lektion -> Starten".
 *
 * It reuses the shared guards (``isPlainEnter`` / ``focusOwnsEnter``)
 * so it behaves consistently with the step-level shortcut: it ignores
 * modifier / IME keystrokes and steps aside whenever a control that
 * owns Enter (button / link / textarea / select / contenteditable /
 * role=button) is focused — so tabbing to a specific CTA and pressing
 * Enter still activates THAT control natively, and this page-level
 * shortcut only fires when focus is on no interactive element.
 *
 * The primary CTA is a router ``<Link>`` (an anchor); the hook
 * activates it with a native ``click()`` so React Router navigation
 * (including any router ``state`` payload) runs exactly as if the user
 * had clicked it. When no primary CTA is present (``ctaRef`` is null —
 * e.g. the last lesson of a set with no adaptive/review card), Enter
 * does nothing, so it never triggers a wrong or missing action.
 */

import {useEffect, type RefObject} from "react";

import {focusOwnsEnter, isPlainEnter} from "./enterKeyGuards";

export interface UseSummaryEnterKeyOptions {
    /** Gated by the Settings > Learning "Enter shortcut" toggle, the
     *  same preference that governs the step-level shortcut. */
    enabled: boolean;
    /** The primary next-step CTA anchor. Null when the summary surfaces
     *  no primary card, in which case Enter is a no-op. */
    ctaRef: RefObject<HTMLAnchorElement | null>;
}

export function useSummaryEnterKey({
    enabled,
    ctaRef,
}: UseSummaryEnterKeyOptions): void {
    useEffect(() => {
        if (!enabled) return;
        const onKey = (e: KeyboardEvent) => {
            if (!isPlainEnter(e)) return;
            if (focusOwnsEnter(document.activeElement as HTMLElement | null)) {
                return;
            }
            const cta = ctaRef.current;
            if (!cta) return;
            e.preventDefault();
            cta.click();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // ``ctaRef`` is a stable ref object; only ``enabled`` re-subscribes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);
}
