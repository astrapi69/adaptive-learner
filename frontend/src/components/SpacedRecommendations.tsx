import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

import {useI18n} from "../hooks/useI18n";
import type {SpacedRecommendation} from "../types";

/**
 * v0.4.0 — spaced-repetition cards on the Dashboard.
 *
 * Each card surfaces a profile-driven "do this next" prompt
 * with an ``interval_days`` band the server picked from the
 * user's :class:`ProgressCommit` recency. Click goes to a
 * fresh ``/session`` in the named method; dismiss hides the
 * card for the rest of the calendar day (persisted in
 * ``localStorage`` so a reload keeps the dismissals).
 *
 * The component takes the FULL server list and filters locally
 * against the dismissed-today set. "Today" is the local YYYY-MM-DD
 * the dismissal was written; sleeping over rolls the date and
 * the cards reappear naturally.
 */
const STORAGE_KEY = "adaptive-learner.spaced_dismissed";

interface DismissalState {
    date: string; // YYYY-MM-DD (local)
    ids: string[];
}

function todayLocalISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function readDismissed(): Set<string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw) as DismissalState;
        if (parsed.date !== todayLocalISO()) return new Set();
        return new Set(parsed.ids ?? []);
    } catch {
        return new Set();
    }
}

function writeDismissed(ids: Set<string>): void {
    const payload: DismissalState = {
        date: todayLocalISO(),
        ids: Array.from(ids),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

interface Props {
    cards: SpacedRecommendation[];
}

export default function SpacedRecommendations({cards}: Props) {
    const {t} = useI18n();
    const navigate = useNavigate();
    const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());

    // Keep React state in sync if another tab dismissed something.
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) {
                setDismissed(readDismissed());
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const visible = cards.filter((c) => !dismissed.has(c.id));

    if (visible.length === 0) {
        return (
            <div className="tile" data-testid="spaced-recs-empty">
                <p className="muted">
                    {t(
                        "dashboard.spaced_empty",
                        "Nothing to refresh right now. Great rhythm!",
                    )}
                </p>
            </div>
        );
    }

    const handleStart = (card: SpacedRecommendation) => {
        // The session-start endpoint accepts an explicit method
        // via query param. Session.tsx reads it on mount; missing
        // = falls back to the profile's dominant method.
        navigate(`/session?method=${encodeURIComponent(card.method)}`);
    };

    const handleDismiss = (card: SpacedRecommendation) => {
        const next = new Set(dismissed);
        next.add(card.id);
        setDismissed(next);
        writeDismissed(next);
    };

    return (
        <ul className="spaced-recs" data-testid="spaced-recs">
            {visible.map((card) => (
                <li
                    key={card.id}
                    className="spaced-rec-card"
                    data-testid={`spaced-rec-${card.id}`}
                >
                    <div className="spaced-rec-body">
                        <p className="spaced-rec-title">{card.title}</p>
                        <p className="spaced-rec-meta muted">
                            {t(
                                "dashboard.spaced_interval_label",
                                "Review in",
                            )}{" "}
                            <strong>{card.interval_days}d</strong>
                        </p>
                    </div>
                    <div className="spaced-rec-actions">
                        <button
                            type="button"
                            className="btn btn-primary"
                            data-testid={`spaced-rec-start-${card.id}`}
                            onClick={() => handleStart(card)}
                        >
                            {t("dashboard.spaced_start", "Start")}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            data-testid={`spaced-rec-dismiss-${card.id}`}
                            onClick={() => handleDismiss(card)}
                            aria-label={t("dashboard.spaced_dismiss", "Dismiss")}
                        >
                            {t("dashboard.spaced_dismiss", "Dismiss")}
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    );
}
