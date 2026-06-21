import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";

import {Button} from "@/components/ui/button";
import AssessmentNav from "../../components/assessment/AssessmentNav";
import AssessmentProgress from "../../components/assessment/AssessmentProgress";
import ProfileRadar from "../../components/progress/ProfileRadar";
import QuestionCard from "../../components/assessment/QuestionCard";
import SpeechButton from "../../components/voice/SpeechButton";
import {ApiError} from "../../api/client";
import {useI18n} from "../../hooks/ui/useI18n";
import {hapticSwipe, useSwipe} from "../../hooks/ui/useSwipe";
import {
    markGestureHintShown,
    readGestureHintShown,
    readGesturePref,
} from "../../lib/settings/gesturePref";
import {readLearnerState} from "../../lib/learning/learnerState";
import {
    clearAssessmentProgress,
    readAssessmentProgress,
    writeAssessmentProgress,
} from "../../lib/assessment/assessmentProgress";
import {METHOD_COLORS} from "../../lib/constants";
import {getStorage} from "../../storage";
import {bestTextOn} from "../../styles/contrast";
import {notify} from "../../utils/notify";
import type {AssessmentQuestion, LearningProfile} from "../../types";

/**
 * Assessment page (project-reference §8 row ``/assessment``).
 *
 * Two phases in one component:
 *
 *   1. Question phase: load the 12-question pack from
 *      ``GET /api/plugins/assessment/questions?lang=…``, render
 *      one ``QuestionCard`` at a time, track the selected
 *      answer per question. Submit only enabled when every
 *      question has an answer.
 *   2. Result phase: POST the answers to
 *      ``/api/plugins/assessment/evaluate``, render the
 *      resulting LearningProfile as a radar chart, plus a CTA
 *      to ``/dashboard``.
 *
 * Pre-condition: ``project_id`` exists in localStorage (set by
 * Onboarding). If missing, we route back to ``/onboarding`` —
 * there's nothing to score against.
 */
export default function Assessment() {
    const {t, lang} = useI18n();
    const navigate = useNavigate();
    const location = useLocation();

    // Safe destination for the first-step "Continue later" exit (#171).
    // Callers that route here (the onboarding wizard, the Dashboard
    // resume/start CTAs) may pass ``state.backTo``; otherwise the
    // Dashboard is always a safe, non-dead-end target — the assessment
    // progress is persisted and resumable from there.
    const backTo =
        (location.state as {backTo?: string} | null)?.backTo ?? "/dashboard";

    const [questions, setQuestions] = useState<AssessmentQuestion[] | null>(null);
    // v0.4.0: answers are now arrays per-question. Single-select
    // questions hold either zero or one entry; multi-select hold
    // 0..N. ``allAnswered`` requires every question to have at
    // least one entry.
    const [answers, setAnswers] = useState<Record<string, string[]>>({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [profile, setProfile] = useState<LearningProfile | null>(null);

    // v1.10.0 / Phase 23B — swipe + keyboard navigation.
    // ``slideDir`` triggers the CSS slide animation on the
    // question card when set; cleared after a short timer so the
    // class doesn't linger across renders.
    const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
    const [showHint, setShowHint] = useState(false);

    // Load questions once on mount (and again when language
    // changes, since the API returns localised text). The
    // dependency intentionally omits ``lang`` re-renders that
    // happen DURING a submit; if the user changes language
    // mid-flow they re-fetch and lose state — acceptable for v0.1.0.
    useEffect(() => {
        const projectId = readLearnerState().projectId;
        if (!projectId) {
            navigate("/onboarding", {replace: true});
            return;
        }
        let cancelled = false;
        getStorage().assessment
            .questions(lang)
            .then((qs) => {
                if (cancelled) return;
                setQuestions(qs);
                setLoadError(null);
            })
            .catch((err) => {
                if (cancelled) return;
                const detail =
                    err instanceof ApiError ? err.detail : t("common.error");
                setLoadError(detail);
            });
        return () => {
            cancelled = true;
        };
        // ``t`` deliberately omitted from deps — see Session.tsx
        // for the rationale (i18n provider's t reference is
        // unstable in tests; including it re-fires the effect).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang, navigate]);

    const total = questions?.length ?? 0;
    const current = questions?.[currentIndex];

    // Resumable assessment (#106). ``restoredRef`` guards the one-shot
    // restore; ``startedAtRef`` preserves the original start time
    // across saves.
    const restoredRef = useRef(false);
    const startedAtRef = useRef<string | null>(null);

    // Restore a saved, incomplete assessment once the questions load.
    useEffect(() => {
        if (!questions || restoredRef.current || profile) return;
        restoredRef.current = true;
        const saved = readAssessmentProgress(readLearnerState().projectId);
        if (saved && Object.keys(saved.answers).length > 0) {
            startedAtRef.current = saved.startedAt;
            setAnswers(saved.answers);
            setCurrentIndex(
                Math.min(
                    Math.max(0, saved.currentQuestion),
                    questions.length - 1,
                ),
            );
        }
    }, [questions, profile]);

    // Persist progress as the learner answers / navigates, so an exit
    // mid-flow can be resumed. Only writes once the restore has run and
    // at least one answer exists; stops once the profile is computed.
    useEffect(() => {
        if (!questions || profile || !restoredRef.current) return;
        if (Object.keys(answers).length === 0) return;
        if (!startedAtRef.current) {
            startedAtRef.current = new Date().toISOString();
        }
        writeAssessmentProgress(readLearnerState().projectId, {
            currentQuestion: currentIndex,
            answers,
            startedAt: startedAtRef.current,
        });
    }, [answers, currentIndex, questions, profile]);

    const allAnswered = useMemo(() => {
        if (!questions || questions.length === 0) return false;
        return questions.every((q) => (answers[q.id]?.length ?? 0) > 0);
    }, [questions, answers]);

    const handleToggle = useCallback(
        (questionId: string, answerId: string) => {
            if (!questions) return;
            const question = questions.find((q) => q.id === questionId);
            if (!question) return;
            setAnswers((prev) => {
                const current = prev[questionId] ?? [];
                if (question.type === "multi") {
                    // Toggle the answer in the array.
                    const next = current.includes(answerId)
                        ? current.filter((a) => a !== answerId)
                        : [...current, answerId];
                    return {...prev, [questionId]: next};
                }
                // Single-select: replace with just this one answer.
                return {...prev, [questionId]: [answerId]};
            });
        },
        [questions],
    );

    const handleSubmit = useCallback(async () => {
        if (!questions || !allAnswered || submitting) return;
        const projectId = readLearnerState().projectId;
        if (!projectId) {
            navigate("/onboarding", {replace: true});
            return;
        }
        setSubmitting(true);
        try {
            const result = await getStorage().assessment.evaluate({
                project_id: projectId,
                answers: questions.map((q) => ({
                    question_id: q.id,
                    answer_ids: answers[q.id] ?? [],
                })),
            });
            setProfile(result);
            // The profile is computed + saved — discard the resumable
            // working state so the Dashboard/Settings no longer offer
            // to resume (#106).
            clearAssessmentProgress(projectId);
            notify.success(t("toast.assessment_saved", "Profile saved."));
            // v1.16.0 / Phase 29A — award 100 XP for completing
            // the assessment. Errors are non-fatal: gamification
            // is optional and must never block the save toast.
            try {
                const userId = readLearnerState().userId;
                if (userId) {
                    await getStorage().gamification.awardAssessment(userId);
                }
            } catch (xpErr) {
                console.warn("XP awardAssessment failed", xpErr);
            }
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    }, [allAnswered, answers, navigate, questions, submitting, t]);

    // --- Swipe + keyboard navigation ----------------------------------

    const goPrev = useCallback(() => {
        if (currentIndex === 0 || submitting) return;
        setSlideDir("right");
        setCurrentIndex((i) => Math.max(0, i - 1));
        hapticSwipe();
    }, [currentIndex, submitting]);

    const goNext = useCallback(() => {
        if (submitting || !questions || !current) return;
        const hasAnswer = (answers[current.id]?.length ?? 0) > 0;
        if (!hasAnswer) return;
        if (currentIndex < total - 1) {
            setSlideDir("left");
            setCurrentIndex((i) => Math.min(total - 1, i + 1));
            hapticSwipe();
        } else if (allAnswered) {
            hapticSwipe();
            void handleSubmit();
        }
    }, [
        allAnswered,
        answers,
        current,
        currentIndex,
        handleSubmit,
        questions,
        submitting,
        total,
    ]);

    // Hint shown on the FIRST question only, and only once per
    // user. Once the user takes ANY action (swipe, keyboard,
    // button click) the hint hides and never returns.
    useEffect(() => {
        if (currentIndex === 0 && !readGestureHintShown()) {
            setShowHint(true);
        } else {
            setShowHint(false);
        }
    }, [currentIndex]);

    const dismissHint = useCallback(() => {
        if (showHint) {
            setShowHint(false);
            markGestureHintShown();
        }
    }, [showHint]);

    const gesturesEnabled = readGesturePref();

    const {ref: swipeRef} = useSwipe<HTMLDivElement>({
        enabled: gesturesEnabled,
        onSwipeLeft: () => {
            dismissHint();
            goNext();
        },
        onSwipeRight: () => {
            dismissHint();
            goPrev();
        },
    });

    // Keyboard left/right arrows — desktop equivalent of swipe.
    // Mirror swipe semantics so the two paths feel identical.
    useEffect(() => {
        if (profile || !questions) return;
        const handleKey = (event: KeyboardEvent) => {
            // Don't hijack arrows in input fields (none on this
            // page, but be safe for future additions).
            const target = event.target as HTMLElement | null;
            if (target && /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName)) {
                return;
            }
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                dismissHint();
                goPrev();
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                dismissHint();
                goNext();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [dismissHint, goNext, goPrev, profile, questions]);

    // Clear the slide direction shortly after each change so the
    // next render is back to a neutral position.
    useEffect(() => {
        if (slideDir === null) return;
        const id = window.setTimeout(() => setSlideDir(null), 220);
        return () => window.clearTimeout(id);
    }, [slideDir]);

    // --- Render states -------------------------------------------------

    if (loadError) {
        return (
            <main id="main" data-testid="assessment-error" className="assessment-page">
                <p className="error-text" role="alert">{loadError}</p>
            </main>
        );
    }

    if (profile) {
        return (
            <main id="main" data-testid="assessment-result" className="assessment-page">
                <header>
                    <h1>{t("assessment.result_title", "Your learning profile")}</h1>
                </header>
                <ProfileRadar profile={profile} />
                <p
                    className="profile-dominant"
                    data-testid="assessment-dominant-method"
                >
                    {t("assessment.dominant_method", "Preferred method")}:{" "}
                    <span
                        className="method-badge"
                        style={{
                            background: `var(--method-${profile.dominant_method})`,
                            color: bestTextOn(METHOD_COLORS[profile.dominant_method]),
                        }}
                    >
                        {t(`methods.${profile.dominant_method}.label`, profile.dominant_method)}
                    </span>
                </p>
                <div className="assessment-result-actions">
                    <SpeechButton
                        text={`${t("assessment.dominant_method", "Preferred method")}: ${t(`methods.${profile.dominant_method}.label`, profile.dominant_method)}`}
                        label={t("assessment.read_summary", "Read summary")}
                        testId="assessment-result"
                    />
                    <Button
                        type="button"
                        data-testid="assessment-continue"
                        variant="default"
                        onClick={() => navigate("/dashboard")}
                    >
                        {t(
                            "assessment.continue_to_dashboard",
                            "Continue to dashboard",
                        )}
                    </Button>
                </div>
            </main>
        );
    }

    if (!questions) {
        return (
            <main id="main" data-testid="assessment-loading" className="assessment-page">
                <p className="muted" role="status">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    if (!current) {
        return (
            <main id="main" data-testid="assessment-empty" className="assessment-page">
                <p className="muted" role="status">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    return (
        <main id="main" data-testid="assessment" className="assessment-page">
            <header>
                <h1>{t("assessment.title", "Learning-type assessment")}</h1>
                <p className="onboarding-intro">{t("assessment.intro")}</p>
            </header>

            <AssessmentProgress current={currentIndex + 1} total={total} />

            <div
                ref={swipeRef}
                className={`assessment-question-wrap${
                    slideDir === "left"
                        ? " assessment-slide-left"
                        : slideDir === "right"
                          ? " assessment-slide-right"
                          : ""
                }`}
                data-testid="assessment-question-wrap"
            >
                <QuestionCard
                    question={current}
                    selectedAnswerIds={answers[current.id] ?? []}
                    onToggle={(answerId) => handleToggle(current.id, answerId)}
                    disabled={submitting}
                />
            </div>

            {showHint && gesturesEnabled && (
                <p
                    className="assessment-swipe-hint"
                    data-testid="assessment-swipe-hint"
                    role="status"
                >
                    {t(
                        "assessment.swipe_hint",
                        "Swipe left / right (or use arrow keys) to navigate.",
                    )}
                </p>
            )}

            <AssessmentNav
                isFirst={currentIndex === 0}
                isLast={currentIndex === total - 1}
                currentAnswered={(answers[current.id]?.length ?? 0) > 0}
                allAnswered={allAnswered}
                submitting={submitting}
                onExit={() => {
                    dismissHint();
                    navigate(backTo);
                }}
                onPrev={() => {
                    dismissHint();
                    goPrev();
                }}
                onNext={() => {
                    dismissHint();
                    goNext();
                }}
                onSubmit={() => {
                    dismissHint();
                    void handleSubmit();
                }}
                t={t}
            />
        </main>
    );
}
