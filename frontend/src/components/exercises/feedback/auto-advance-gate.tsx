/**
 * Auto-advance suppression gate (#1921).
 *
 * Auto-advance (#1330) is a reward for a JUST-checked correct answer: on a
 * fully-correct answer the lesson jumps to the next step by itself. When the
 * learner instead navigates BACK to an already-completed exercise (the
 * "Zurück" button), resumes onto a completed step, or follows a step
 * deep-link, the step re-mounts in its locked ``reviewed`` state and
 * {@link ../feedback/ExerciseSuccessAdvance} would otherwise fire its
 * auto-advance timer immediately and shove the learner forward again —
 * defeating the Back button. This context lets the lesson runner mark such a
 * re-entry so the success badge + manual "Continue" stay, but the automatic
 * jump does not.
 *
 * Default ``false`` (no provider) so the Review / Adaptive runners and every
 * direct-mount test keep the original behaviour without wrapping.
 */

import {createContext, useContext, type ReactNode} from "react";

const AutoAdvanceSuppressedContext = createContext<boolean>(false);

/**
 * Provide whether auto-advance must be suppressed for the exercise rendered
 * inside. The lesson runner passes ``suppressed = enteredReviewed`` so a
 * revisit never auto-jumps.
 *
 * @param suppressed - True to disable the auto-advance timer for descendants.
 * @param children - The exercise subtree (the dispatcher).
 */
export function AutoAdvanceSuppressedProvider({
    suppressed,
    children,
}: {
    suppressed: boolean;
    children: ReactNode;
}) {
    return (
        <AutoAdvanceSuppressedContext.Provider value={suppressed}>
            {children}
        </AutoAdvanceSuppressedContext.Provider>
    );
}

/** Read whether the current exercise must suppress auto-advance. Defaults to
 *  false when no provider is present. */
export function useAutoAdvanceSuppressed(): boolean {
    return useContext(AutoAdvanceSuppressedContext);
}
