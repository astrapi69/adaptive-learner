import {useCallback, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";

import AssessmentProgress from "../components/AssessmentProgress";
import ProfileRadar from "../components/ProfileRadar";
import QuestionCard from "../components/QuestionCard";
import {api, ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {readLearnerState} from "../lib/learnerState";
import {notify} from "../utils/notify";
import type {AssessmentQuestion, LearningProfile} from "../types";

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

    const [questions, setQuestions] = useState<AssessmentQuestion[] | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [profile, setProfile] = useState<LearningProfile | null>(null);

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
        api.assessment
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
    }, [lang, navigate, t]);

    const total = questions?.length ?? 0;
    const current = questions?.[currentIndex];

    const allAnswered = useMemo(() => {
        if (!questions || questions.length === 0) return false;
        return questions.every((q) => answers[q.id]);
    }, [questions, answers]);

    const handleSelect = useCallback((questionId: string, answerId: string) => {
        setAnswers((prev) => ({...prev, [questionId]: answerId}));
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!questions || !allAnswered || submitting) return;
        const projectId = readLearnerState().projectId;
        if (!projectId) {
            navigate("/onboarding", {replace: true});
            return;
        }
        setSubmitting(true);
        try {
            const result = await api.assessment.evaluate({
                project_id: projectId,
                answers: questions.map((q) => ({
                    question_id: q.id,
                    answer_id: answers[q.id],
                })),
            });
            setProfile(result);
            notify.success(t("toast.assessment_saved", "Profile saved."));
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    }, [allAnswered, answers, navigate, questions, submitting, t]);

    // --- Render states -------------------------------------------------

    if (loadError) {
        return (
            <main data-testid="assessment-error" className="assessment-page">
                <p className="error-text">{loadError}</p>
            </main>
        );
    }

    if (profile) {
        return (
            <main data-testid="assessment-result" className="assessment-page">
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
                            color: "#ffffff",
                        }}
                    >
                        {t(`methods.${profile.dominant_method}.label`, profile.dominant_method)}
                    </span>
                </p>
                <button
                    type="button"
                    data-testid="assessment-continue"
                    className="btn btn-primary"
                    onClick={() => navigate("/dashboard")}
                >
                    {t("assessment.continue_to_dashboard", "Continue to dashboard")}
                </button>
            </main>
        );
    }

    if (!questions) {
        return (
            <main data-testid="assessment-loading" className="assessment-page">
                <p className="muted">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    if (!current) {
        return (
            <main data-testid="assessment-empty" className="assessment-page">
                <p className="muted">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    return (
        <main data-testid="assessment" className="assessment-page">
            <header>
                <h1>{t("assessment.title", "Learning-type assessment")}</h1>
                <p className="onboarding-intro">{t("assessment.intro")}</p>
            </header>

            <AssessmentProgress current={currentIndex + 1} total={total} />

            <QuestionCard
                question={current}
                selectedAnswerId={answers[current.id] ?? null}
                onSelect={(answerId) => handleSelect(current.id, answerId)}
                disabled={submitting}
            />

            <div className="form-actions">
                <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid="assessment-prev"
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    disabled={currentIndex === 0 || submitting}
                >
                    {t("assessment.prev_question", "Previous question")}
                </button>

                {currentIndex < total - 1 ? (
                    <button
                        type="button"
                        className="btn btn-primary"
                        data-testid="assessment-next"
                        onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
                        disabled={!answers[current.id] || submitting}
                    >
                        {t("assessment.next_question", "Next question")}
                    </button>
                ) : (
                    <button
                        type="button"
                        className="btn btn-primary"
                        data-testid="assessment-submit"
                        onClick={handleSubmit}
                        disabled={!allAnswered || submitting}
                    >
                        {submitting
                            ? t("assessment.evaluating", "Evaluating…")
                            : t("assessment.submit", "Evaluate")}
                    </button>
                )}
            </div>
        </main>
    );
}
