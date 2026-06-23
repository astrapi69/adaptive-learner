/**
 * Lesson-mode context (#1007 / #1011).
 *
 * Provides the active mode's {@link LessonModeConfig} to the subtree.
 * Exercise + help components read flags off it (``showHints``,
 * ``immediateFeedback``, …) instead of branching on a mode string — so a
 * new mode is one row in {@link MODE_CONFIGS}, not a component change.
 *
 * The default is the ``practice`` config, so any surface WITHOUT a
 * provider — the Review and Adaptive-Lesson runners, and every existing
 * test — behaves exactly as before (all aids on, immediate feedback). Only
 * the main lesson player wraps its content in {@link LessonModeProvider}.
 */

import {createContext, useContext, type ReactNode} from "react";

import {
    configForMode,
    MODE_CONFIGS,
    type LessonModeConfig,
} from "../../lib/learning/lessonModeConfig";
import type {LessonMode} from "../../lib/learning/lessonModePref";

const LessonModeContext = createContext<LessonModeConfig>(
    MODE_CONFIGS.practice,
);

export interface LessonModeProviderProps {
    mode: LessonMode;
    children: ReactNode;
}

/** Provide the active mode's config to the subtree. */
export function LessonModeProvider({mode, children}: LessonModeProviderProps) {
    return (
        <LessonModeContext.Provider value={configForMode(mode)}>
            {children}
        </LessonModeContext.Provider>
    );
}

/** The active lesson-mode config. The ``practice`` config when no provider
 *  is present (all aids on, immediate feedback). */
export function useLessonMode(): LessonModeConfig {
    return useContext(LessonModeContext);
}
