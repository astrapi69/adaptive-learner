/**
 * Lesson-mode context (#1007).
 *
 * Practice mode (the default) keeps every learning aid on; exam mode hides
 * the scaffolding (theory recap, hints, auto-read, the solution / answer
 * toggles, and the celebration) so the learner retrieves under realistic
 * conditions — the "testing effect".
 *
 * Exercise renderers + helper components read the mode through
 * {@link useLessonMode} instead of threading a prop through four layers.
 * The default is ``practice`` so any surface WITHOUT a provider — the
 * Review and Adaptive-Lesson runners, and every existing test — behaves
 * exactly as before (all aids on). Only the main lesson player wraps its
 * content in {@link LessonModeProvider} with the active mode.
 */

import {createContext, useContext, type ReactNode} from "react";

import type {LessonMode} from "../../lib/learning/lessonModePref";

const LessonModeContext = createContext<LessonMode>("practice");

export interface LessonModeProviderProps {
    mode: LessonMode;
    children: ReactNode;
}

/** Provide the active lesson mode to the subtree. */
export function LessonModeProvider({mode, children}: LessonModeProviderProps) {
    return (
        <LessonModeContext.Provider value={mode}>
            {children}
        </LessonModeContext.Provider>
    );
}

/** The active lesson mode. ``practice`` when no provider is present. */
export function useLessonMode(): LessonMode {
    return useContext(LessonModeContext);
}

/** Convenience: true when the current subtree runs in exam mode (aids
 *  hidden). ``false`` outside a provider. */
export function useIsExamMode(): boolean {
    return useContext(LessonModeContext) === "exam";
}
