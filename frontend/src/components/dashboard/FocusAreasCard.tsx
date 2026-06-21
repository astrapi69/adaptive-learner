/**
 * FocusAreasCard — Dashboard widget for the adaptive lesson
 * generator's suggested focus elements (Phase 53F / v1.36.0 /
 * F-114 / EXP-013).
 *
 * Reads all active ``ElementError`` rows via
 * ``getStorage().elementErrors.list(userId, {includeMastered:
 * true})`` on mount, runs the analyzer to derive the top-N
 * suggested focus, classifies the focus tags for the
 * "challenge areas" chips, and renders an entry point to the
 * adaptive lesson page (53G).
 *
 * States:
 *   - loading → small placeholder (data-testid: focus-areas-card-loading)
 *   - empty   → returns null (the new-user / no-errors case;
 *               keeps the Dashboard grid tidy, parallel to
 *               ReviewQueueCard's hide-when-empty behaviour)
 *   - ready   → card with focus list + tags + CTA
 *
 * Storage-mode-agnostic: routes through ``getStorage()`` so
 * the Dexie-mode build at GitHub Pages renders this widget
 * client-side (no backend). The Phase 53H smoke gate pins
 * this.
 *
 * Failure-tolerant: any read error sets ``state = "empty"``
 * so a transient failure hides the widget rather than
 * breaking the Dashboard.
 */

import {Sparkles} from "lucide-react";
import {useEffect, useState} from "react";
import {Link} from "react-router-dom";

import {analyzeErrors} from "../../lib/adaptive/error-analyzer";
import {focusAreaTags} from "../../lib/adaptive/error-classifier";
import type {ErrorTag} from "../../lib/adaptive/error-classifier";
import {masteryCounts, type MasteryCounts} from "../../lib/srs/mastery";
import type {PrioritizedElement} from "../../lib/adaptive/types";
import {useI18n} from "../../hooks/ui/useI18n";
import {getStorage} from "../../storage";

const TAG_I18N_KEYS: Record<ErrorTag, [string, string]> = {
    article_gender: [
        "dashboard.focus_areas.tag.article_gender",
        "Article gender",
    ],
    spelling_accent: [
        "dashboard.focus_areas.tag.spelling_accent",
        "Spelling & accents",
    ],
    verb_conjugation: [
        "dashboard.focus_areas.tag.verb_conjugation",
        "Verb conjugation",
    ],
    word_order: [
        "dashboard.focus_areas.tag.word_order",
        "Word order",
    ],
};

const MASTERY_STREAK_TARGET = 3;

export interface FocusAreasCardProps {
    userId: string;
}

interface ResolvedState {
    suggested: PrioritizedElement[];
    tags: ErrorTag[];
    totalErrors: number;
    targetSetId: string;
    /** EXP-018 / Phase 62 — receptive vs productive mastery split. */
    mastery: MasteryCounts;
    /** #594 Hint Economy — lifetime count of answers given with a hint. */
    hintAnswers: number;
}

export default function FocusAreasCard({userId}: FocusAreasCardProps) {
    const {t} = useI18n();
    const [state, setState] = useState<ResolvedState | "loading" | "empty">(
        "loading",
    );

    useEffect(() => {
        if (!userId) {
            setState("empty");
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const errors = await getStorage().elementErrors.list(userId, {
                    includeMastered: true,
                });
                if (cancelled) return;
                const analysis = analyzeErrors(errors);
                if (analysis.suggested_focus.length === 0) {
                    setState("empty");
                    return;
                }
                const tags = focusAreaTags(analysis.suggested_focus, errors);
                const targetSetId = analysis.suggested_focus[0].set_id;
                setState({
                    suggested: analysis.suggested_focus,
                    tags,
                    totalErrors: analysis.total_errors,
                    targetSetId,
                    mastery: masteryCounts(errors),
                    hintAnswers: errors.reduce(
                        (sum, e) => sum + (e.hint_used_count ?? 0),
                        0,
                    ),
                });
            } catch {
                if (!cancelled) setState("empty");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    if (state === "loading") {
        return (
            <article
                className="dashboard-card"
                data-testid="focus-areas-card-loading"
            >
                <h2 className="dashboard-card-title">
                    {t("dashboard.card_focus_areas", "Focus areas")}
                </h2>
                <p className="muted">
                    {t("dashboard.focus_areas.loading", "Analyzing your errors…")}
                </p>
            </article>
        );
    }

    if (state === "empty") {
        return null;
    }

    const adaptiveHref = `/adaptive-lesson/${encodeURIComponent(state.targetSetId)}`;

    return (
        <article
            className="dashboard-card"
            data-testid="focus-areas-card"
        >
            <h2 className="dashboard-card-title">
                {t("dashboard.card_focus_areas", "Focus areas")}
            </h2>
            {(state.mastery.receptive > 0 || state.mastery.productive > 0) && (
                <p
                    className="muted focus-areas-mastery-split"
                    data-testid="focus-areas-mastery-split"
                >
                    {t(
                        "dashboard.focus_areas.mastery_split",
                        "Receptive: {receptive} · Productive: {productive}",
                    )
                        .replace("{receptive}", String(state.mastery.receptive))
                        .replace(
                            "{productive}",
                            String(state.mastery.productive),
                        )}
                </p>
            )}
            {state.hintAnswers > 0 && (
                <p
                    className="muted focus-areas-hint-answers"
                    data-testid="focus-areas-hint-answers"
                >
                    {t(
                        "dashboard.focus_areas.hint_answers",
                        "{n} answers with a hint",
                    ).replace("{n}", String(state.hintAnswers))}
                </p>
            )}
            {state.tags.length > 0 && (
                <p
                    className="muted focus-areas-tags"
                    data-testid="focus-areas-tags"
                >
                    {t(
                        "dashboard.focus_areas.subtitle",
                        "Your challenge areas:",
                    )}{" "}
                    {state.tags
                        .map((tag) => t(...TAG_I18N_KEYS[tag]))
                        .join(", ")}
                </p>
            )}
            <ul className="focus-areas-list flex list-none flex-col gap-2">
                {state.suggested.map((focus) => (
                    <li
                        key={focus.element_key}
                        className="focus-areas-item flex items-center gap-3"
                        data-testid={`focus-area-item-${focus.element_key}`}
                    >
                        <span className="focus-areas-key min-w-0 flex-1 truncate">
                            {focus.element_key}
                        </span>
                        <span className="muted shrink-0 whitespace-nowrap text-sm">
                            {focus.error_count}{" "}
                            {t("dashboard.focus_areas.errors", "errors")}
                        </span>
                        <progress
                            className="focus-areas-progress w-24 shrink-0"
                            value={focus.correct_streak}
                            max={MASTERY_STREAK_TARGET}
                            aria-label={t(
                                "dashboard.focus_areas.mastery_progress",
                                "Mastery progress",
                            )}
                        />
                    </li>
                ))}
            </ul>
            <Link
                to={adaptiveHref}
                className="btn btn-primary"
                data-testid="focus-areas-cta"
            >
                <Sparkles size={14} aria-hidden="true" />
                {t(
                    "dashboard.focus_areas.cta",
                    "Start adaptive lesson",
                )}
            </Link>
        </article>
    );
}
