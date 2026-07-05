/**
 * useLessonSessionErrors (#1372).
 *
 * The live ``ElementError`` rows for one lesson. Read on mount and
 * refetched whenever the SRS review state changes
 * (``REVIEWS_CHANGED_EVENT``) — e.g. after an error-replay round records
 * corrections — so the lesson summary's "Fehler wiederholen" suggestion
 * reflects the current state instead of the frozen ``step_results``.
 *
 * Same read in both storage modes (``getStorage().elementErrors.list``);
 * failures degrade to an empty list rather than throwing.
 */

import {useEffect, useState} from "react";

import {REVIEWS_CHANGED_EVENT} from "../../lib/review/reviewsChanged";
import {getStorage} from "../../storage";
import type {ElementError} from "../../storage/types";

export function useLessonSessionErrors(
    userId: string,
    setId: string,
    lessonFilename: string,
): ElementError[] {
    const [sessionErrors, setSessionErrors] = useState<ElementError[]>([]);

    useEffect(() => {
        if (!userId) {
            setSessionErrors([]);
            return;
        }
        let cancelled = false;
        const refresh = async () => {
            try {
                const errs = await getStorage().elementErrors.list(userId, {
                    setId,
                });
                if (cancelled) return;
                setSessionErrors(
                    errs.filter((e) => e.lesson_id === lessonFilename),
                );
            } catch {
                if (!cancelled) setSessionErrors([]);
            }
        };
        void refresh();
        const onReviewsChanged = () => void refresh();
        window.addEventListener(REVIEWS_CHANGED_EVENT, onReviewsChanged);
        return () => {
            cancelled = true;
            window.removeEventListener(REVIEWS_CHANGED_EVENT, onReviewsChanged);
        };
    }, [userId, setId, lessonFilename]);

    return sessionErrors;
}
