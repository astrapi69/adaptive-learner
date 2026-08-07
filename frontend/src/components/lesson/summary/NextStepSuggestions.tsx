/**
 * NextStepSuggestions — the "What's next?" card stack on the
 * lesson summary screen (Phase 64 / smart-next-steps).
 *
 * Renders the suggestions computed by ``useNextStepSuggestions``
 * as a prioritised stack of forward-navigation cards:
 *
 *   - Next Lesson    (Start, or Resume when Phase-63 paused)
 *   - Adaptive       (focus on the run's top weakness; errors > 0)
 *   - Review         (SRS items due for this set)
 *   - Set Complete   (last lesson; offers another unfinished set)
 *
 * #2496 — the "Retry Errors" card (and its all-corrected success
 * state) moved into the summary's single mistakes section
 * (``CorrectionBlock``), so it is no longer part of this stack; the
 * two used to duplicate the same "fix your mistakes" intent.
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

import {useRef, type RefObject} from "react";
import {ArrowRight, Play, RefreshCw, Target, Trophy} from "lucide-react";
import {Link} from "react-router";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonShortcuts} from "../../../hooks/lesson/interaction/useLessonShortcuts";
import {useSummaryEnterKey} from "../../../hooks/lesson/interaction/useSummaryEnterKey";
import type {ErrorTag} from "../../../lib/adaptive/error-classifier";
import {prefersReducedMotion} from "../../../lib/feedback/feedbackPref";
import type {NextStepSuggestions as Suggestions} from "../../../hooks/learning/useNextStepSuggestions";

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
    /** #1411 — the "Next-step suggestions" section toggle; defaults ON.
     *  When disabled, the summary's secondary actions keep a plain
     *  "Next lesson" fallback so forward navigation never disappears. */
    enabled?: boolean;
    suggestions: Suggestions;
    setId: string;
    /** The raw set slug from the route (``--``-encoded source),
     *  needed to build the next-lesson + error-replay hrefs. */
    setSlug: string;
}

type PrimaryAction = Suggestions["primaryAction"];

/** Stagger delay for the entrance animation, by render position. */
function cardStyle(animate: boolean, idx: number): React.CSSProperties {
    return animate ? {animationDelay: `${idx * 200}ms`} : {};
}

/** Class list for a suggestion card (kind + primary/secondary/complete
 *  modifier + the animation marker). */
function cardClassName(
    kind: string,
    modifier: "is-primary" | "is-secondary" | "is-complete",
    animate: boolean,
): string {
    return (
        `lesson-next-step-card ${modifier}${animate ? " is-animated" : ""}` +
        ` lesson-next-step-card-${kind}`
    );
}

function NextLessonCard({
    data,
    setSlug,
    setId,
    primaryAction,
    animate,
    idx,
    ctaRef,
}: {
    data: Suggestions["nextLesson"];
    setSlug: string;
    setId: string;
    primaryAction: PrimaryAction;
    animate: boolean;
    idx: number;
    ctaRef: RefObject<HTMLAnchorElement | null>;
}) {
    const {t} = useI18n();
    const isPrimary = primaryAction === "next";
    const href = `/lesson/${setSlug}/${setId}/${data.lessonFilename}`;
    return (
        <div
            className={cardClassName(
                "next",
                isPrimary ? "is-primary" : "is-secondary",
                animate,
            )}
            style={cardStyle(animate, idx)}
            data-testid="next-step-card-next"
            data-primary={isPrimary ? "true" : "false"}
        >
            <span className="lesson-next-step-card-icon" aria-hidden="true">
                <Play size={20} />
            </span>
            <span className="lesson-next-step-card-body">
                <span className="lesson-next-step-card-kicker">
                    {data.isPaused
                        ? t("lesson.next_step.resume", "Resume")
                        : t("lesson.next_step.next_lesson", "Next Lesson")}
                </span>
                <span className="lesson-next-step-card-title">{data.title}</span>
                {data.isPaused &&
                    data.pausedStep != null &&
                    data.totalSteps != null && (
                        <span className="lesson-next-step-card-sub">
                            {t(
                                "lesson.next_step.resume_detail",
                                "Step {step} of {total}",
                            )
                                .replace("{step}", String(data.pausedStep))
                                .replace("{total}", String(data.totalSteps))}
                        </span>
                    )}
            </span>
            <Button asChild variant={isPrimary ? "default" : "secondary"}>
                <Link
                    to={href}
                    ref={isPrimary ? ctaRef : undefined}
                    data-testid="next-step-cta-next"
                >
                    {data.isPaused
                        ? t("lesson.next_step.resume", "Resume")
                        : t("lesson.next_step.start", "Start")}
                    <ArrowRight aria-hidden="true" />
                </Link>
            </Button>
        </div>
    );
}

function AdaptiveCard({
    data,
    setIdEnc,
    primaryAction,
    animate,
    idx,
    ctaRef,
}: {
    data: Suggestions["adaptiveLesson"];
    setIdEnc: string;
    primaryAction: PrimaryAction;
    animate: boolean;
    idx: number;
    ctaRef: RefObject<HTMLAnchorElement | null>;
}) {
    const {t} = useI18n();
    const isPrimary = primaryAction === "adaptive";
    const topic = data.focusTag
        ? t(...TAG_I18N_KEYS[data.focusTag])
        : t("lesson.next_step.focus_vocabulary", "Vocabulary");
    return (
        <div
            className={cardClassName(
                "adaptive",
                isPrimary ? "is-primary" : "is-secondary",
                animate,
            )}
            style={cardStyle(animate, idx)}
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
                    ).replace("{count}", String(data.errorCount))}
                </span>
            </span>
            <Button asChild variant={isPrimary ? "default" : "secondary"}>
                <Link
                    to={`/adaptive-lesson/${setIdEnc}`}
                    ref={isPrimary ? ctaRef : undefined}
                    data-testid="next-step-cta-adaptive"
                >
                    {t("lesson.next_step.start", "Start")}
                    <ArrowRight aria-hidden="true" />
                </Link>
            </Button>
        </div>
    );
}

function ReviewCard({
    data,
    setIdEnc,
    primaryAction,
    animate,
    idx,
    ctaRef,
}: {
    data: Suggestions["reviewSession"];
    setIdEnc: string;
    primaryAction: PrimaryAction;
    animate: boolean;
    idx: number;
    ctaRef: RefObject<HTMLAnchorElement | null>;
}) {
    const {t} = useI18n();
    const isPrimary = primaryAction === "review";
    return (
        <div
            className={cardClassName(
                "review",
                isPrimary ? "is-primary" : "is-secondary",
                animate,
            )}
            style={cardStyle(animate, idx)}
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
                    {t("lesson.next_step.review_due", "{count} elements due").replace(
                        "{count}",
                        String(data.dueCount),
                    )}
                </span>
            </span>
            <Button asChild variant={isPrimary ? "default" : "secondary"}>
                <Link
                    to={`/review/${setIdEnc}`}
                    ref={isPrimary ? ctaRef : undefined}
                    data-testid="next-step-cta-review"
                >
                    {t("lesson.next_step.start", "Start")}
                    <ArrowRight aria-hidden="true" />
                </Link>
            </Button>
        </div>
    );
}

function SetCompleteCard({
    setIdEnc,
    setTitle,
    lessonCount,
    suggestedSet,
    animate,
    idx,
}: {
    setIdEnc: string;
    setTitle: Suggestions["setTitle"];
    lessonCount: Suggestions["lessonCount"];
    suggestedSet: Suggestions["suggestedSet"];
    animate: boolean;
    idx: number;
}) {
    const {t} = useI18n();
    return (
        <div
            className={cardClassName("complete", "is-complete", animate)}
            style={cardStyle(animate, idx)}
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
                        {t("lesson.next_step.try_set", "How about: {set}").replace(
                            "{set}",
                            suggestedSet.title,
                        )}
                    </span>
                )}
            </span>
            {/* "View Set" opens the just-completed set's detail page (its
                lesson list), NOT the generic Discover overview — the card is
                about this set, so the CTA shows whenever the set is complete,
                independent of the optional "How about …" suggestion above. */}
            <Button asChild variant="secondary">
                <Link
                    to={`/content/set/${setIdEnc}`}
                    data-testid="next-step-cta-view-set"
                >
                    {t("lesson.next_step.view_set", "View Set")}
                    <ArrowRight aria-hidden="true" />
                </Link>
            </Button>
        </div>
    );
}

export default function NextStepSuggestions({
    enabled = true,
    suggestions,
    setId,
    setSlug,
}: NextStepSuggestionsProps) {
    const {t} = useI18n();

    // #1943 — Enter activates the accent-highlighted PRIMARY next-step
    // CTA (e.g. "Nächste Lektion -> Starten"). The ref points at whichever
    // card ``primaryAction`` marks primary; the hook clicks it natively so
    // React Router navigation (incl. router state) runs as on a real click.
    // Gated by the same Settings "Enter shortcut" toggle as the step-level
    // shortcut, and only while this section actually renders a card.
    const shortcutsEnabled = useLessonShortcuts();
    const primaryCtaRef = useRef<HTMLAnchorElement>(null);
    useSummaryEnterKey({
        enabled: shortcutsEnabled && enabled && !suggestions.loading,
        ctaRef: primaryCtaRef,
    });

    if (!enabled || suggestions.loading) return null;

    const {
        nextLesson,
        adaptiveLesson,
        reviewSession,
        setComplete,
        setTitle,
        lessonCount,
        suggestedSet,
        primaryAction,
    } = suggestions;

    // #2496 — the error-replay CTA (and its all-corrected success state) moved
    // into the summary's correction section, so this card stack no longer
    // renders it. Forward-navigation cards only.
    const anything =
        nextLesson.available ||
        adaptiveLesson.available ||
        reviewSession.available ||
        setComplete;
    if (!anything) return null;

    const animate = !prefersReducedMotion();
    const setIdEnc = encodeURIComponent(setId);

    // Build the cards in priority order, assigning a sequential
    // index so the entrance animation staggers in render order.
    const cards: React.ReactNode[] = [];
    if (nextLesson.available) {
        cards.push(
            <NextLessonCard
                key="next"
                data={nextLesson}
                setSlug={setSlug}
                setId={setId}
                primaryAction={primaryAction}
                animate={animate}
                idx={cards.length}
                ctaRef={primaryCtaRef}
            />,
        );
    }
    if (adaptiveLesson.available) {
        cards.push(
            <AdaptiveCard
                key="adaptive"
                data={adaptiveLesson}
                setIdEnc={setIdEnc}
                primaryAction={primaryAction}
                animate={animate}
                idx={cards.length}
                ctaRef={primaryCtaRef}
            />,
        );
    }
    if (reviewSession.available) {
        cards.push(
            <ReviewCard
                key="review"
                data={reviewSession}
                setIdEnc={setIdEnc}
                primaryAction={primaryAction}
                animate={animate}
                idx={cards.length}
                ctaRef={primaryCtaRef}
            />,
        );
    }
    if (setComplete) {
        cards.push(
            <SetCompleteCard
                key="complete"
                setIdEnc={setIdEnc}
                setTitle={setTitle}
                lessonCount={lessonCount}
                suggestedSet={suggestedSet}
                animate={animate}
                idx={cards.length}
            />,
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
