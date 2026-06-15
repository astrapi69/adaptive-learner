/**
 * ReviewQueueCard — Dashboard widget for the SRS review queue
 * (Phase 46C / P-129; reworked for #588).
 *
 * Reads ``getStorage().elementErrors.reviewQueue(userId)`` on mount and
 * renders the reusable, presentational ``shared/DueReviewCard`` (count +
 * overdue sub-count + a one-click "open review session" action linking
 * to the first set's review route). Three states: loading placeholder,
 * empty (renders null — DueReviewCard hides itself at 0), and populated.
 *
 * Storage-mode-agnostic (routes through getStorage; Dexie computes the
 * queue client-side). Failure-tolerant: a read error sets an empty queue
 * so a transient failure hides the widget rather than breaking the
 * Dashboard.
 */

import {RefreshCw} from "lucide-react";
import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

import DueReviewCard from "../../shared/DueReviewCard";
import {useI18n} from "../../hooks/useI18n";
import {getStorage} from "../../storage";
import type {ReviewQueueItem} from "../../storage/types";

export interface ReviewQueueCardProps {
    userId: string;
}

export default function ReviewQueueCard({userId}: ReviewQueueCardProps) {
    const {t} = useI18n();
    const navigate = useNavigate();
    const [items, setItems] = useState<ReviewQueueItem[] | null>(null);

    useEffect(() => {
        if (!userId) {
            setItems([]);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const queue = await getStorage().elementErrors.reviewQueue(
                    userId,
                );
                if (!cancelled) setItems(queue);
            } catch {
                if (!cancelled) setItems([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    if (items === null) {
        return (
            <article
                className="dashboard-card"
                data-testid="review-queue-card-loading"
            >
                <h2 className="dashboard-card-title">
                    {t("dashboard.card_review_queue", "Due for review")}
                </h2>
                <p className="muted">
                    {t("dashboard.review_queue.loading", "Loading…")}
                </p>
            </article>
        );
    }

    if (items.length === 0) {
        // Nothing to surface; keep the dashboard grid tidy.
        return null;
    }

    const overdue = items.filter((i) => i.overdue).length;
    // Link to the first set in the queue; the review page synthesises a
    // mini-lesson from that set's queue and resolves the source slug
    // from the content cache.
    const firstSetId = items[0].set_id;

    return (
        <article className="dashboard-card" data-testid="review-queue-card">
            <h2 className="dashboard-card-title">
                {t("dashboard.card_review_queue", "Due for review")}
            </h2>
            <DueReviewCard
                total={items.length}
                overdue={overdue}
                totalLabel={t(
                    "dashboard.review_queue.elements",
                    "element(s) due for review",
                )}
                overdueLabel={t(
                    "dashboard.review_queue.overdue",
                    "overdue — start here",
                )}
                startLabel={t(
                    "dashboard.review_queue.open",
                    "Open review session",
                )}
                onStart={() =>
                    navigate(`/review/${encodeURIComponent(firstSetId)}`)
                }
                icon={<RefreshCw size={14} aria-hidden="true" />}
                testId="review-queue"
            />
        </article>
    );
}
