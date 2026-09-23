/**
 * useMatchingSeparateCorrections (#3186).
 *
 * Returns whether the Matching exercise shows its corrections as a
 * separate post-check view, re-reading live when the preference changes
 * in this tab (``MATCHING_REVIEW_VIEWS_PREF_CHANGE_EVENT``) or in another
 * tab (native ``storage`` event) - same shape as ``usePlayfulMode`` so the
 * Settings toggle takes effect without a reload.
 */

import {useEffect, useState} from "react";

import {
    MATCHING_REVIEW_VIEWS_PREF_CHANGE_EVENT,
    readMatchingSeparateCorrections,
} from "../../lib/learning/matchingReviewViewsPref";

export function useMatchingSeparateCorrections(): boolean {
    const [separate, setSeparate] = useState<boolean>(() =>
        readMatchingSeparateCorrections(),
    );

    useEffect(() => {
        const refresh = () => setSeparate(readMatchingSeparateCorrections());

        window.addEventListener(MATCHING_REVIEW_VIEWS_PREF_CHANGE_EVENT, refresh);
        window.addEventListener("storage", refresh);

        // Pick up any change that happened between the initial
        // useState and the effect mount.
        refresh();

        return () => {
            window.removeEventListener(
                MATCHING_REVIEW_VIEWS_PREF_CHANGE_EVENT,
                refresh,
            );
            window.removeEventListener("storage", refresh);
        };
    }, []);

    return separate;
}
