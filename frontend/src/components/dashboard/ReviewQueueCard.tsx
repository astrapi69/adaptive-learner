/**
 * ReviewQueueCard — Dashboard widget for the SRS review
 * queue (Phase 46C / C13 / P-129).
 *
 * Reads ``getStorage().elementErrors.reviewQueue(userId)``
 * on mount. Renders three states:
 *
 *   - loading → small placeholder
 *   - empty   → returns null (nothing to surface)
 *   - non-empty → "{N} due for review" + "{overdue} overdue"
 *                 counter + "Open review session" CTA linking
 *                 to the first set's review route (C14 ships
 *                 ``/review/:setSlug/:setId``).
 *
 * Storage-mode-agnostic: routes through ``getStorage()`` so
 * Dexie + Api modes both work. The Dexie path computes the
 * queue client-side (C12) — no backend needed.
 *
 * Failure-tolerant: the catch branch sets ``items=[]`` so a
 * transient fetch failure hides the widget rather than
 * breaking the Dashboard.
 */

import {RefreshCw} from "lucide-react";
import {useEffect, useState} from "react";
import {Link} from "react-router-dom";

import {useI18n} from "../../hooks/useI18n";
import {getStorage} from "../../storage";
import type {ReviewQueueItem} from "../../storage/types";

export interface ReviewQueueCardProps {
    userId: string;
}

export default function ReviewQueueCard({userId}: ReviewQueueCardProps) {
    const {t} = useI18n();
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
                    {t(
                        "dashboard.card_review_queue",
                        "Due for review",
                    )}
                </h2>
                <p className="muted">
                    {t("dashboard.review_queue.loading", "Loading…")}
                </p>
            </article>
        );
    }

    if (items.length === 0) {
        // Nothing to surface; keep the dashboard grid tidy
        // by rendering nothing rather than an empty card.
        return null;
    }

    const overdue = items.filter((i) => i.overdue).length;
    // The "Open review session" CTA links to the first set
    // represented in the queue; the review session UI in C14
    // synthesises a mini-lesson from that set's queue.
    const firstSetId = items[0].set_id;
    // The source slug isn't on ReviewQueueItem (it's not in
    // ElementError); the review page resolves it from the
    // user's content-loader cache. For now we deep-link to
    // /review/{setId} which C14's route normalises.
    const reviewHref = `/review/${encodeURIComponent(firstSetId)}`;

    return (
        <article
            className="dashboard-card"
            data-testid="review-queue-card"
        >
            <h2 className="dashboard-card-title">
                {t("dashboard.card_review_queue", "Due for review")}
            </h2>
            <p
                className="review-queue-count"
                data-testid="review-queue-count"
            >
                <strong data-testid="review-queue-total">
                    {items.length}
                </strong>{" "}
                {t(
                    "dashboard.review_queue.elements",
                    "element(s) due for review",
                )}
            </p>
            {overdue > 0 && (
                <p
                    className="review-queue-overdue"
                    data-testid="review-queue-overdue"
                >
                    <strong>{overdue}</strong>{" "}
                    {t(
                        "dashboard.review_queue.overdue",
                        "overdue — start here",
                    )}
                </p>
            )}
            <Link
                to={reviewHref}
                className="btn btn-primary"
                data-testid="review-queue-cta"
            >
                <RefreshCw size={14} aria-hidden="true" />
                {t(
                    "dashboard.review_queue.open",
                    "Open review session",
                )}
            </Link>
        </article>
    );
}
