/**
 * useSessionRating (#1804 — extracted from Session.tsx).
 *
 * The end-of-session flow: open the rating dialog, submit the
 * rating (``rate`` then ``end``), and navigate back to the
 * Dashboard on success.
 */

import {useState} from "react";
import type {NavigateFunction} from "react-router";

import {ApiError} from "../../api/client";
import type {RatingValues} from "../../components/session/RatingDialog";
import {getStorage} from "../../storage";
import {notify} from "../../utils/notify";
import type {LearningSession} from "../../types";

/** i18n translate signature (key + optional fallback). */
type Translate = (key: string, fallback?: string) => string;

/**
 * Own the rating-dialog visibility + submit state and the
 * rate-then-end handler.
 *
 * @example
 * const {showRating, setShowRating, submittingRating,
 *     handleRatingSubmit} = useSessionRating({session, navigate, t});
 * <RatingDialog open={showRating} onSubmit={handleRatingSubmit} ... />
 */
export function useSessionRating({
    session,
    navigate,
    t,
}: {
    session: LearningSession | null;
    navigate: NavigateFunction;
    t: Translate;
}) {
    const [showRating, setShowRating] = useState(false);
    const [submittingRating, setSubmittingRating] = useState(false);

    const handleRatingSubmit = async (rating: RatingValues) => {
        if (!session || submittingRating) return;
        setSubmittingRating(true);
        try {
            await getStorage().session.rate(session.id, {
                understanding: rating.understanding,
                stress: rating.stress,
                method_fit: rating.method_fit,
                notes: rating.notes.length > 0 ? rating.notes : null,
            });
            await getStorage().session.end(session.id);
            notify.success(t("toast.session_ended", "Session ended."));
            setShowRating(false);
            navigate("/dashboard");
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setSubmittingRating(false);
        }
    };

    return {showRating, setShowRating, submittingRating, handleRatingSubmit};
}
