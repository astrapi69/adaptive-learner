/**
 * useMatchingPostCheckView (#824 / #977 / #3186).
 *
 * The post-check view state of the matching exercise, extracted from
 * MatchingExercise for the complexity gate. After the answer is checked
 * the learner toggles between their own graded answers ("user-answers"),
 * the same grid with the correct partner under each mistake
 * ("corrections", #3186) and the revealed solution ("solution"). Default
 * is the plain graded grid, which is what the columns render after submit.
 */

import {useRef, useState} from "react";

import {useMatchingSeparateCorrections} from "../../../../hooks/settings/useMatchingSeparateCorrections";
import type {MatchingPostCheckView} from "./MatchingViewToggle";

export interface MatchingPostCheckViewState {
    /** The active view (never "corrections" in the two-view layout). */
    view: MatchingPostCheckView;
    /** Whether a wrong pair spells out its correct partner. */
    showCorrection: boolean;
    /** The animate flag for MatchingResolution: true only on the first
     *  reveal of the solution (#977). */
    animateSolution: boolean;
    showUserAnswers: () => void;
    /** Undefined in the two-view layout, so the toggle hides the button. */
    showCorrections: (() => void) | undefined;
    showSolution: () => void;
    /** Back to the plain graded view, animation re-armed (Try again). */
    resetView: () => void;
}

/**
 * @param showAnswerToggle - the lesson mode's toggle flag (off in exam).
 */
export function useMatchingPostCheckView(
    showAnswerToggle: boolean,
): MatchingPostCheckViewState {
    const [selectedView, setView] = useState<MatchingPostCheckView>(
        "user-answers",
    );
    // Settings > Learning "Corrections as a separate view" (default on).
    // Off = the #977 two-view toggle with the corrections inline.
    const separateCorrections = useMatchingSeparateCorrections();
    // A live switch to the two-view layout while "corrections" is open
    // falls back to "My answers" (which then carries the corrections), so
    // the toggle never ends up with no active button.
    const view: MatchingPostCheckView =
        !separateCorrections && selectedView === "corrections"
            ? "user-answers"
            : selectedView;
    /** Whether the solution view has been shown at least once, so the
     *  reveal animation plays only on the FIRST switch (#977). A ref (not
     *  state) so flipping it never triggers a re-render mid-animation. */
    const solutionShownRef = useRef(false);
    const [animateSolution, setAnimateSolution] = useState(false);

    /** Switch to the revealed-solution view (#977). Animates only the
     *  first time it is shown; toggling back to it later renders the end
     *  result immediately. No-op when already on the solution view so a
     *  repeat click can't restart a mid-play animation. */
    const showSolution = () => {
        if (view === "solution") return;
        const firstTime = !solutionShownRef.current;
        solutionShownRef.current = true;
        setAnimateSolution(firstTime);
        setView("solution");
    };

    return {
        view,
        // Correct partners show in the Corrections view, in the two-view
        // layout, and whenever the mode hides the toggle (exam): there the
        // inline corrections are the only way to see the right answer.
        showCorrection:
            view === "corrections" || !separateCorrections || !showAnswerToggle,
        animateSolution,
        showUserAnswers: () => setView("user-answers"),
        showCorrections: separateCorrections
            ? () => setView("corrections")
            : undefined,
        showSolution,
        resetView: () => {
            setView("user-answers");
            solutionShownRef.current = false;
            setAnimateSolution(false);
        },
    };
}
