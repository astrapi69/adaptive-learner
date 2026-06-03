/**
 * NextStepSuggestions — the "What's next?" card stack on the
 * lesson summary screen (Phase 64 / smart-next-steps).
 *
 * Renders the suggestions computed by ``useNextStepSuggestions``
 * as a prioritised stack of cards:
 *
 *   - Next Lesson    (Start, or Resume when Phase-63 paused)
 *   - Adaptive       (focus on the run's top weakness; errors > 0)
 *   - Review         (SRS items due for this set)
 *   - Set Complete   (last lesson; offers another unfinished set)
 *
 * The ``primaryAction`` from the hook decides which of the
 * next / adaptive / review cards gets the accent-coloured primary
 * CTA; the rest are secondary. The set-complete card carries its
 * own celebratory styling.
 *
 * All CTAs are router ``<Link>``s — the next/resume link points
 * at the same ``/lesson/...`` route (a paused successor shows the
 * Phase-63 resume prompt automatically), adaptive/review/view-set
 * point at the existing ``/adaptive-lesson/:setId`` /
 * ``/review/:setId`` / ``/content`` routes. Everything works in
 * Dexie mode (no backend).
 *
 * Cards slide up with a 200ms stagger; ``prefers-reduced-motion``
 * suppresses the animation (no ``is-animated`` class, no delay).
 */

import {ArrowRight, Play, RefreshCw, RotateCcw, Target, Trophy} from "lucide-react";
import {Link} from "react-router-dom";

import {useI18n} from "../../hooks/useI18n";
import type {ErrorTag} from "../../lib/adaptive/error-classifier";
import {prefersReducedMotion} from "../../lib/feedback/feedbackPref";
import type {NextStepSuggestions as Suggestions} from "../../hooks/useNextStepSuggestions";
import type {
    ContentLessonCard,
    ContentLessonExercise,
} from "../../storage/types";

/** Router-state payload handed to the ErrorReplayLesson page — the
 *  exact failed exercises (+ the lesson's cards for code-mode +
 *  per-element context, + the title for the header). */
export interface ErrorReplayPayload {
    exercises: ContentLessonExercise[];
    cards: ContentLessonCard[];
    lessonTitle: string;
}

/** Reuse the Dashboard FocusAreasCard tag labels so the
 *  weakness headline stays consistent across the app. */
const TAG_I18N_KEYS: Record<ErrorTag, [string, string]> = {
    article_gender: ["dashboard.focus_areas.tag.article_gender", "Article gender"],
    spelling_accent: [
        "dashboard.focus_areas.tag.spelling_accent",
        "Spelling & accents",
    ],
    verb_conjugation: [
        "dashboard.focus_areas.tag.verb_conjugation",
        "Verb conjugation",
    ],
    word_order: ["dashboard.focus_areas.tag.word_order", "Word order"],
};

export interface NextStepSuggestionsProps {
    suggestions: Suggestions;
    setId: string;
    /** The raw set slug from the route (``--``-encoded source),
     *  needed to build the next-lesson + error-replay hrefs. */
    setSlug: string;
    /** This lesson's filename — part of the error-replay route. */
    lessonFilename: string;
    /** The failed exercises (+ cards + title) handed to the
     *  ErrorReplay page via router state. Present only when there
     *  were errors; the error-replay card hides without it. */
    errorReplay?: ErrorReplayPayload;
}

export default function NextStepSuggestions({
    suggestions,
    setId,
    setSlug,
    lessonFilename,
    errorReplay: errorReplayPayload,
}: NextStepSuggestionsProps) {
    const {t} = useI18n();

    if (suggestions.loading) return null;

    const {
        nextLesson,
        errorReplay,
        adaptiveLesson,
        reviewSession,
        setComplete,
        setTitle,
        lessonCount,
        suggestedSet,
        primaryAction,
    } = suggestions;

    const showErrorReplay =
        errorReplay.available && errorReplayPayload != null;

    const anything =
        nextLesson.available ||
        showErrorReplay ||
        adaptiveLesson.available ||
        reviewSession.available ||
        setComplete;
    if (!anything) return null;

    const animate = !prefersReducedMotion();
    const setIdEnc = encodeURIComponent(setId);

    // Build the cards in priority order, assigning a sequential
    // index so the entrance animation staggers in render order.
    const cards: React.ReactNode[] = [];
    const delay = (i: number): React.CSSProperties =>
        animate ? {animationDelay: `${i * 200}ms`} : {};
    const cardClass = (
        kind: string,
        modifier: "is-primary" | "is-secondary" | "is-complete",
    ) =>
        `lesson-next-step-card ${modifier}${animate ? " is-animated" : ""}` +
        ` lesson-next-step-card-${kind}`;

    if (nextLesson.available) {
        const isPrimary = primaryAction === "next";
        const href = `/lesson/${setSlug}/${setId}/${nextLesson.lessonFilename}`;
        const idx = cards.length;
        cards.push(
            <div
                key="next"
                className={cardClass(
                    "next",
                    isPrimary ? "is-primary" : "is-secondary",
                )}
                style={delay(idx)}
                data-testid="next-step-card-next"
                data-primary={isPrimary ? "true" : "false"}
            >
                <span className="lesson-next-step-card-icon" aria-hidden="true">
                    <Play size={20} />
                </span>
                <span className="lesson-next-step-card-body">
                    <span className="lesson-next-step-card-kicker">
                        {nextLesson.isPaused
                            ? t("lesson.next_step.resume", "Resume")
                            : t("lesson.next_step.next_lesson", "Next Lesson")}
                    </span>
                    <span className="lesson-next-step-card-title">
                        {nextLesson.title}
                    </span>
                    {nextLesson.isPaused &&
                        nextLesson.pausedStep != null &&
                        nextLesson.totalSteps != null && (
                            <span className="lesson-next-step-card-sub">
                                {t(
                                    "lesson.next_step.resume_detail",
                                    "Step {step} of {total}",
                                )
                                    .replace(
                                        "{step}",
                                        String(nextLesson.pausedStep),
                                    )
                                    .replace(
                                        "{total}",
                                        String(nextLesson.totalSteps),
                                    )}
                            </span>
                        )}
                </span>
                <Link
                    to={href}
                    className={`btn ${isPrimary ? "btn-primary" : ""}`.trim()}
                    data-testid="next-step-cta-next"
                >
                    {nextLesson.isPaused
                        ? t("lesson.next_step.resume", "Resume")
                        : t("lesson.next_step.start", "Start")}
                    <ArrowRight size={14} aria-hidden="true" />
                </Link>
            </div>,
        );
    }

    if (showErrorReplay && errorReplayPayload) {
        const isPrimary = primaryAction === "error_replay";
        const idx = cards.length;
        cards.push(
            <div
                key="error-replay"
                className={cardClass(
                    "error-replay",
                    isPrimary ? "is-primary" : "is-secondary",
                )}
                style={delay(idx)}
                data-testid="next-step-card-error-replay"
                data-primary={isPrimary ? "true" : "false"}
            >
                <span className="lesson-next-step-card-icon" aria-hidden="true">
                    <RotateCcw size={20} />
                </span>
                <span className="lesson-next-step-card-body">
                    <span className="lesson-next-step-card-kicker">
                        {t("lesson.next_step.error_replay", "Retry Errors")}
                    </span>
                    <span className="lesson-next-step-card-title">
                        {t(
                            "lesson.next_step.error_replay_detail",
                            "{count} exercises again",
                        ).replace(
                            "{count}",
                            String(errorReplay.errorCount),
                        )}
                    </span>
                </span>
                <Link
                    to={`/error-replay/${setSlug}/${setId}/${lessonFilename}`}
                    state={errorReplayPayload}
                    className={`btn ${isPrimary ? "btn-primary" : ""}`.trim()}
                    data-testid="next-step-cta-error-replay"
                >
                    {t("lesson.next_step.start", "Start")}
                    <ArrowRight size={14} aria-hidden="true" />
                </Link>
            </div>,
        );
    }

    if (adaptiveLesson.available) {
        const isPrimary = primaryAction === "adaptive";
        const topic = adaptiveLesson.focusTag
            ? t(...TAG_I18N_KEYS[adaptiveLesson.focusTag])
            : t("lesson.next_step.focus_vocabulary", "Vocabulary");
        const idx = cards.length;
        cards.push(
            <div
                key="adaptive"
                className={cardClass(
                    "adaptive",
                    isPrimary ? "is-primary" : "is-secondary",
                )}
                style={delay(idx)}
                data-testid="next-step-card-adaptive"
                data-primary={isPrimary ? "true" : "false"}
            >
                <span className="lesson-next-step-card-icon" aria-hidden="true">
                    <Target size={20} />
                </span>
                <span className="lesson-next-step-card-body">
                    <span className="lesson-next-step-card-kicker">
                        {t("lesson.next_step.adaptive", "Adaptive Lesson")}
                    </span>
                    <span className="lesson-next-step-card-title">
                        {t(
                            "lesson.next_step.adaptive_focus",
                            "Focus on: {topic}",
                        ).replace("{topic}", topic)}
                    </span>
                    <span className="lesson-next-step-card-sub">
                        {t(
                            "lesson.next_step.adaptive_errors",
                            "{count} errors in this lesson",
                        ).replace("{count}", String(adaptiveLesson.errorCount))}
                    </span>
                </span>
                <Link
                    to={`/adaptive-lesson/${setIdEnc}`}
                    className={`btn ${isPrimary ? "btn-primary" : ""}`.trim()}
                    data-testid="next-step-cta-adaptive"
                >
                    {t("lesson.next_step.start", "Start")}
                    <ArrowRight size={14} aria-hidden="true" />
                </Link>
            </div>,
        );
    }

    if (reviewSession.available) {
        const isPrimary = primaryAction === "review";
        const idx = cards.length;
        cards.push(
            <div
                key="review"
                className={cardClass(
                    "review",
                    isPrimary ? "is-primary" : "is-secondary",
                )}
                style={delay(idx)}
                data-testid="next-step-card-review"
                data-primary={isPrimary ? "true" : "false"}
            >
                <span className="lesson-next-step-card-icon" aria-hidden="true">
                    <RefreshCw size={20} />
                </span>
                <span className="lesson-next-step-card-body">
                    <span className="lesson-next-step-card-kicker">
                        {t("lesson.next_step.review", "Review")}
                    </span>
                    <span className="lesson-next-step-card-title">
                        {t(
                            "lesson.next_step.review_due",
                            "{count} elements due",
                        ).replace(
                            "{count}",
                            String(reviewSession.dueCount),
                        )}
                    </span>
                </span>
                <Link
                    to={`/review/${setIdEnc}`}
                    className={`btn ${isPrimary ? "btn-primary" : ""}`.trim()}
                    data-testid="next-step-cta-review"
                >
                    {t("lesson.next_step.start", "Start")}
                    <ArrowRight size={14} aria-hidden="true" />
                </Link>
            </div>,
        );
    }

    if (setComplete) {
        const idx = cards.length;
        cards.push(
            <div
                key="complete"
                className={cardClass("complete", "is-complete")}
                style={delay(idx)}
                data-testid="next-step-card-complete"
            >
                <span className="lesson-next-step-card-icon" aria-hidden="true">
                    <Trophy size={20} />
                </span>
                <span className="lesson-next-step-card-body">
                    <span className="lesson-next-step-card-kicker">
                        {t("lesson.next_step.set_complete", "Set Complete!")}
                    </span>
                    {setTitle && lessonCount != null && (
                        <span className="lesson-next-step-card-title">
                            {t(
                                "lesson.next_step.set_complete_detail",
                                "All {count} lessons in {set} completed!",
                            )
                                .replace("{count}", String(lessonCount))
                                .replace("{set}", setTitle)}
                        </span>
                    )}
                    {suggestedSet && (
                        <span className="lesson-next-step-card-sub">
                            {t(
                                "lesson.next_step.try_set",
                                "How about: {set}",
                            ).replace("{set}", suggestedSet.title)}
                        </span>
                    )}
                </span>
                {suggestedSet && (
                    <Link
                        to="/content"
                        className="btn"
                        data-testid="next-step-cta-view-set"
                    >
                        {t("lesson.next_step.view_set", "View Set")}
                        <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                )}
            </div>,
        );
    }

    return (
        <section
            className="lesson-next-step"
            data-testid="next-step-suggestions"
            aria-label={t("lesson.next_step.title", "What's next?")}
        >
            <h3 className="lesson-next-step-title">
                {t("lesson.next_step.title", "What's next?")}
            </h3>
            <div className="lesson-next-step-cards">{cards}</div>
        </section>
    );
}
