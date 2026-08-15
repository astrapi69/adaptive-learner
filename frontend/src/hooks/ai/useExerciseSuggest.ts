/**
 * useExerciseSuggest — the React side of the Stage-4 AI-suggest helpers
 * (EXP-050, #2511).
 *
 * The pure suggestion functions live in
 * ``lib/ai/suggest/exercise-suggest.ts`` and take an injected
 * {@link AiProvider} seam. This hook is the ONE place the create-lesson editor
 * resolves that seam: it reads the active BYOK provider from the learner's
 * IndexedDB settings (``readLearnerState`` -> ``resolveActiveAiProvider`` ->
 * ``browserDirectProvider``), exactly like {@link AiVerifyAnswer} and exercise
 * generation, so no prop-drilling of a provider through the editor tree.
 *
 * Shape:
 *
 *   const {ready, hasKey, busy, error, clearError, suggest} =
 *     useExerciseSuggest();
 *   const words = await suggest((provider) => suggestDistractors(ex, provider));
 *
 * - ``ready`` / ``hasKey`` come from {@link useApiKeyStatus}; a button greys out
 *   while ``!hasKey`` and points the author at ``/settings?tab=ai`` (BYOK).
 * - ``suggest(runner)`` resolves the provider, flips ``busy``, runs the
 *   injected pure function, and returns its result — or ``null`` when there is
 *   no key or the call failed, with ``error`` set to a localized message. It
 *   NEVER throws, so a caller can `const out = await suggest(...)` and branch on
 *   null without a try/catch.
 */

import {useCallback, useRef, useState} from "react";

import {useApiKeyStatus} from "../settings/useApiKeyStatus";
import {useI18n} from "../ui/useI18n";
import {readLearnerState} from "../../lib/learning/learnerState";
import {resolveActiveAiProvider} from "../../lib/ai/providers/resolve-provider";
import {browserDirectProvider} from "../../lib/ai/generation/generate-exercises";
import type {AiProvider} from "../../lib/ai/generation/generate-exercises";

export interface UseExerciseSuggest {
    /** True once the key status has resolved — don't claim "no key" before. */
    ready: boolean;
    /** True iff the active provider has a BYOK key configured. */
    hasKey: boolean;
    /** A suggestion request is in flight. */
    busy: boolean;
    /** Localized error from the last run, or null. */
    error: string | null;
    /** Clear the error (e.g. when the author edits the field by hand). */
    clearError: () => void;
    /**
     * Resolve the browser-direct provider and run ``runner`` against it.
     * Returns the runner's result, or ``null`` when there is no usable key or
     * the call failed (``error`` is then set). A second call while one is in
     * flight is ignored (returns null).
     */
    suggest: <T>(runner: (provider: AiProvider) => Promise<T>) => Promise<T | null>;
}

export function useExerciseSuggest(): UseExerciseSuggest {
    const {t} = useI18n();
    const {ready, hasKey} = useApiKeyStatus();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Guard against overlapping runs without waiting for the busy state to
    // flush (setState is async; a double-click could slip through).
    const inFlight = useRef(false);

    const clearError = useCallback(() => setError(null), []);

    const suggest = useCallback(
        async <T,>(runner: (provider: AiProvider) => Promise<T>): Promise<T | null> => {
            if (inFlight.current) return null;
            inFlight.current = true;
            setBusy(true);
            setError(null);
            try {
                const {userId} = readLearnerState();
                const resolved = userId ? await resolveActiveAiProvider(userId) : null;
                if (!resolved) {
                    setError(
                        t(
                            "create_lesson.suggest.no_key",
                            "This needs your own AI key (BYOK). Add one under AI settings.",
                        ),
                    );
                    return null;
                }
                return await runner(browserDirectProvider(resolved));
            } catch (err) {
                setError(
                    err instanceof Error && err.message
                        ? err.message
                        : t(
                              "create_lesson.suggest.error",
                              "The AI request failed. Please try again.",
                          ),
                );
                return null;
            } finally {
                inFlight.current = false;
                setBusy(false);
            }
        },
        [t],
    );

    return {ready, hasKey, busy, error, clearError, suggest};
}
