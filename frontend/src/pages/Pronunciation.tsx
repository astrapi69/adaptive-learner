/**
 * Pronunciation Practice page (Phase 31C / v1.18.0).
 *
 * Loop:
 *   1. ``Generate phrase`` → AI returns a target.
 *   2. SpeechButton lets the user hear the target.
 *   3. MicButton captures the user's attempt (STT).
 *   4. ``Submit attempt`` → AI judges + returns feedback.
 *   5. ``Next phrase`` returns to step 1 (prior phrases get
 *      appended to ``previous`` so the model doesn't repeat).
 *
 * Eligibility is checked on mount via
 * ``storage.pronunciation.eligibility``. Non-language projects
 * see a guidance card instead of the practice surface.
 */

import {useCallback, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

import ApiKeyRequiredNotice from "../components/ApiKeyRequiredNotice";
import MicButton from "../components/MicButton";
import SpeechButton from "../components/SpeechButton";
import {ApiError} from "../api/client";
import {useApiKeyStatus} from "../hooks/useApiKeyStatus";
import {useI18n} from "../hooks/useI18n";
import {readLearnerState} from "../lib/learnerState";
import {getStorage} from "../storage";
import type {PronunciationVerdict} from "../storage/types";
import type {LearningProject} from "../types";
import {notify} from "../utils/notify";

export default function PronunciationPage() {
    const {t} = useI18n();
    const navigate = useNavigate();
    // Issue 4 — pronunciation needs both generate + judge AI
    // calls, so the whole page surface is gated on the active
    // provider having a key.
    const apiKey = useApiKeyStatus();
    const [project, setProject] = useState<LearningProject | null>(null);
    const [eligible, setEligible] = useState<boolean | null>(null);
    const [target, setTarget] = useState<string>("");
    const [actual, setActual] = useState<string>("");
    const [verdict, setVerdict] = useState<PronunciationVerdict | null>(null);
    const [recent, setRecent] = useState<string[]>([]);
    const [generating, setGenerating] = useState(false);
    const [judging, setJudging] = useState(false);
    const [language, setLanguage] = useState<string>("English");
    const learner = readLearnerState();

    useEffect(() => {
        if (!learner.userId || !learner.projectId) {
            navigate("/onboarding", {replace: true});
            return;
        }
        let cancelled = false;
        const storage = getStorage();
        // Resolve project + eligibility in parallel.
        Promise.all([
            storage.projects.get(learner.projectId),
            storage.pronunciation.eligibility(learner.projectId),
        ])
            .then(([proj, elig]) => {
                if (cancelled) return;
                setProject(proj);
                setEligible(elig.eligible);
                // Default the target language to the project's
                // topic — the AI accepts either a language name
                // ("Spanish") or a BCP-47 code ("es"). Topic
                // strings work as language hints for most
                // language-learning projects.
                if (proj?.topic) setLanguage(proj.topic);
            })
            .catch(() => {
                if (cancelled) return;
                setEligible(false);
            });
        return () => {
            cancelled = true;
        };
    }, [learner.userId, learner.projectId, navigate]);

    const generatePhrase = useCallback(async () => {
        if (!learner.projectId) return;
        setGenerating(true);
        setVerdict(null);
        setActual("");
        try {
            const r = await getStorage().pronunciation.phrase({
                project_id: learner.projectId,
                language,
                previous: recent,
            });
            setTarget(r.phrase);
            setRecent((prev) => [...prev, r.phrase].slice(-10));
        } catch (err) {
            const msg =
                err instanceof ApiError
                    ? err.detail
                    : t(
                          "pronunciation.phrase_failed",
                          "Could not generate a phrase.",
                      );
            notify.error(msg);
        } finally {
            setGenerating(false);
        }
    }, [learner.projectId, language, recent, t]);

    const submitAttempt = useCallback(async () => {
        if (!learner.projectId || !target || !actual.trim()) return;
        setJudging(true);
        try {
            const r = await getStorage().pronunciation.judge({
                project_id: learner.projectId,
                target,
                actual: actual.trim(),
                language,
            });
            setVerdict(r);
        } catch (err) {
            const msg =
                err instanceof ApiError
                    ? err.detail
                    : t(
                          "pronunciation.judge_failed",
                          "Could not score that attempt.",
                      );
            notify.error(msg);
        } finally {
            setJudging(false);
        }
    }, [learner.projectId, target, actual, language, t]);

    if (eligible === null) {
        return (
            <main className="pronunciation-page" data-testid="pronunciation-loading">
                <p className="muted">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }
    if (!eligible) {
        return (
            <main
                className="pronunciation-page"
                data-testid="pronunciation-ineligible"
            >
                <header className="page-header">
                    <h1>{t("pronunciation.title", "Pronunciation Practice")}</h1>
                </header>
                <p className="muted">
                    {t(
                        "pronunciation.ineligible",
                        "Pronunciation practice is available for language-learning projects. Add a subject under 'Languages' to your project to enable it.",
                    )}
                </p>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate("/dashboard")}
                >
                    {t("common.back", "Back")}
                </button>
            </main>
        );
    }

    return (
        <main className="pronunciation-page" data-testid="pronunciation-page">
            <header className="page-header">
                <h1>{t("pronunciation.title", "Pronunciation Practice")}</h1>
                <p className="muted">
                    {t(
                        "pronunciation.intro",
                        "Generate a phrase, speak it aloud, and get instant feedback.",
                    )}
                </p>
                {project && (
                    <p className="muted" data-testid="pronunciation-project">
                        {t("pronunciation.project_label", "Project")}: {project.topic}
                    </p>
                )}
            </header>

            <section className="pronunciation-card">
                <header className="pronunciation-card__header">
                    <span className="pronunciation-card__label">
                        {t("pronunciation.target_label", "Target phrase")}
                    </span>
                    {target && (
                        <SpeechButton
                            text={target}
                            lang={language}
                            testId="target"
                            label={t("voice.speak", "Read aloud")}
                        />
                    )}
                </header>
                <p
                    className="pronunciation-card__target"
                    data-testid="pronunciation-target"
                >
                    {target || t("pronunciation.no_phrase", "Click Generate to start.")}
                </p>
                {apiKey.ready && !apiKey.hasKey && (
                    <ApiKeyRequiredNotice
                        compact
                        feature={t(
                            "ui.api_key.feature_pronunciation",
                            "for pronunciation practice",
                        )}
                    />
                )}
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={generatePhrase}
                    disabled={
                        generating || !apiKey.ready || !apiKey.hasKey
                    }
                    title={
                        apiKey.ready && !apiKey.hasKey
                            ? t(
                                  "ui.api_key.required",
                                  "API key required.",
                              )
                            : undefined
                    }
                    data-testid="pronunciation-generate"
                >
                    {generating
                        ? t("pronunciation.generating", "Generating…")
                        : target
                          ? t("pronunciation.next_phrase", "Next phrase")
                          : t("pronunciation.generate", "Generate phrase")}
                </button>
            </section>

            {target && (
                <section className="pronunciation-card">
                    <header className="pronunciation-card__header">
                        <span className="pronunciation-card__label">
                            {t("pronunciation.your_attempt", "Your attempt")}
                        </span>
                        <MicButton
                            lang={language}
                            testId="pronunciation"
                            onTranscript={(text) => setActual(text)}
                        />
                    </header>
                    <textarea
                        value={actual}
                        onChange={(e) => setActual(e.target.value)}
                        placeholder={t(
                            "pronunciation.attempt_placeholder",
                            "Tap the mic to dictate, or type what you said.",
                        )}
                        rows={2}
                        data-testid="pronunciation-attempt-input"
                    />
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={submitAttempt}
                        disabled={judging || !actual.trim()}
                        data-testid="pronunciation-submit"
                    >
                        {judging
                            ? t("pronunciation.judging", "Scoring…")
                            : t("pronunciation.submit", "Submit attempt")}
                    </button>
                </section>
            )}

            {verdict && (
                <section
                    className={
                        "pronunciation-verdict " +
                        (verdict.matches
                            ? "pronunciation-verdict--match"
                            : "pronunciation-verdict--miss")
                    }
                    data-testid="pronunciation-verdict"
                    data-match={verdict.matches ? "true" : "false"}
                >
                    <p className="pronunciation-verdict__score">
                        <strong>
                            {Math.round(verdict.score * 100)}%
                        </strong>{" "}
                        {verdict.matches
                            ? t("pronunciation.match", "Match")
                            : t("pronunciation.miss", "Keep practising")}
                    </p>
                    <p className="pronunciation-verdict__feedback">
                        {verdict.feedback}
                    </p>
                    {verdict.missed_sounds.length > 0 && (
                        <p
                            className="pronunciation-verdict__sounds"
                            data-testid="pronunciation-missed-sounds"
                        >
                            {t("pronunciation.focus_on", "Focus on:")}{" "}
                            {verdict.missed_sounds.join(", ")}
                        </p>
                    )}
                </section>
            )}
        </main>
    );
}
