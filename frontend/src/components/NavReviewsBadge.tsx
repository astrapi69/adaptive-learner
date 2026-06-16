/**
 * NavReviewsBadge — a small header badge that appears next to the XP
 * badge when the learner has spaced-repetition reviews due (#588).
 *
 * Reads the SRS review queue from whichever storage backing is active
 * and shows the count of OVERDUE elements; it links to that set's
 * review session. Renders nothing when nothing is due, so it never adds
 * header clutter on a fresh install. Refreshes on mount, route change,
 * tab focus, and after a lesson-complete celebration (reviews change as
 * elements are answered).
 */

import {RefreshCw} from "lucide-react";
import {useEffect, useState} from "react";
import {NavLink, useLocation} from "react-router-dom";

import {useI18n} from "../hooks/useI18n";
import {readLearnerState} from "../lib/learnerState";
import {subscribeCelebration} from "../lib/praise/celebration-bus";
import {REVIEWS_CHANGED_EVENT} from "../lib/review/reviewsChanged";
import {getStorage} from "../storage";
import type {CelebrationType} from "../lib/praise/celebration-bus";

const REVIEW_AFFECTING: ReadonlySet<CelebrationType> = new Set<CelebrationType>(
    ["lesson_complete"],
);

interface DueState {
    overdue: number;
    firstSetId: string | null;
}

export default function NavReviewsBadge() {
    const {t} = useI18n();
    const {pathname} = useLocation();
    const [state, setState] = useState<DueState | null>(null);

    useEffect(() => {
        const userId = readLearnerState().userId;
        if (!userId) {
            setState(null);
            return;
        }
        let cancelled = false;
        async function refresh() {
            try {
                const queue =
                    await getStorage().elementErrors.reviewQueue(userId!);
                if (cancelled) return;
                const overdueItems = queue.filter((q) => q.overdue);
                setState({
                    overdue: overdueItems.length,
                    firstSetId: overdueItems[0]?.set_id ?? null,
                });
            } catch {
                // Supplementary chrome — never surface a read failure.
            }
        }
        void refresh();
        const onFocus = () => void refresh();
        window.addEventListener("focus", onFocus);
        // #629 BUG 3c — a review session moved an element's next-review
        // time; recompute the due count live (the user is still on the
        // review page, so the route-change refresh hasn't fired yet).
        const onReviewsChanged = () => void refresh();
        window.addEventListener(REVIEWS_CHANGED_EVENT, onReviewsChanged);
        const unsubscribe = subscribeCelebration((event) => {
            if (REVIEW_AFFECTING.has(event.type)) void refresh();
        });
        return () => {
            cancelled = true;
            window.removeEventListener("focus", onFocus);
            window.removeEventListener(REVIEWS_CHANGED_EVENT, onReviewsChanged);
            unsubscribe();
        };
    }, [pathname]);

    if (!state || state.overdue === 0) return null;

    const href = state.firstSetId
        ? `/review/${encodeURIComponent(state.firstSetId)}`
        : "/dashboard";
    const label = t("srs.due_badge", "{n} due").replace(
        "{n}",
        String(state.overdue),
    );
    return (
        <NavLink
            to={href}
            className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
            data-testid="nav-reviews-badge"
            title={t("srs.due_badge_tooltip", "Reviews due")}
            aria-label={t("srs.due_badge_aria", "{n} reviews due").replace(
                "{n}",
                String(state.overdue),
            )}
        >
            <RefreshCw size={12} aria-hidden="true" />
            {label}
        </NavLink>
    );
}
