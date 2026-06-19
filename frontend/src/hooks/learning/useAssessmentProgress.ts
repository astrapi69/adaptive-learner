/**
 * useAssessmentProgress (#106).
 *
 * Returns whether an incomplete assessment is saved for a project,
 * re-reading live when the assessment saves or clears progress in this
 * tab (``ASSESSMENT_PROGRESS_CHANGE_EVENT``) or another tab (native
 * ``storage`` event). The Dashboard invitation and the Settings entry
 * read this so they appear / disappear without a reload.
 */

import {useEffect, useState} from "react";

import {
    ASSESSMENT_PROGRESS_CHANGE_EVENT,
    hasIncompleteAssessment,
} from "../../lib/assessment/assessmentProgress";

export function useHasIncompleteAssessment(projectId: string | null): boolean {
    const [incomplete, setIncomplete] = useState<boolean>(() =>
        hasIncompleteAssessment(projectId),
    );

    useEffect(() => {
        const refresh = () => setIncomplete(hasIncompleteAssessment(projectId));

        window.addEventListener(ASSESSMENT_PROGRESS_CHANGE_EVENT, refresh);
        window.addEventListener("storage", refresh);

        // Re-read for the current projectId (and catch any change
        // between the initial useState and mount).
        refresh();

        return () => {
            window.removeEventListener(ASSESSMENT_PROGRESS_CHANGE_EVENT, refresh);
            window.removeEventListener("storage", refresh);
        };
    }, [projectId]);

    return incomplete;
}
