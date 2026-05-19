import {useState, type FormEvent} from "react";
import {useNavigate} from "react-router-dom";

import {ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {SUPPORTED_LANGUAGES} from "../lib/constants";
import {setProjectId, setUserId} from "../lib/learnerState";
import {getStorage} from "../storage";
import {notify} from "../utils/notify";

/**
 * Pick a sensible starting language for the Skip flow. The
 * browser ``navigator.language`` returns e.g. "en-US" or
 * "de-DE"; we accept the 2-char prefix when it's one of the
 * supported catalog languages, otherwise fall back to English.
 */
function defaultLanguageFromBrowser(): string {
    const raw = (typeof navigator !== "undefined" && navigator.language) || "en";
    const prefix = raw.slice(0, 2).toLowerCase();
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(prefix)
        ? prefix
        : "en";
}

/**
 * Onboarding page (project-reference §8 row ``/onboarding``).
 *
 * Two backend roundtrips on submit:
 *
 *   1. ``POST /api/users``        — creates the User row, returns id.
 *   2. ``POST /api/users/{id}/projects`` — creates the LearningProject.
 *
 * Both ids are written to localStorage; downstream pages
 * (Assessment, Dashboard, Session, Settings) read them via
 * ``readLearnerState``. On success we route the user straight
 * to ``/assessment``.
 *
 * The form is one column: name + topic + goal + timeframe +
 * daily_minutes are required (matching the Pydantic
 * ``LearningProjectCreateBody`` constraints); current_problem
 * is optional. Validation is permissive in the markup (we let
 * the backend's Pydantic schema be the authority) but we trim
 * whitespace + require non-empty before submitting to avoid an
 * obvious 422 round-trip on empty input.
 */
export default function Onboarding() {
    const {t, lang} = useI18n();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);

    const [name, setName] = useState("");
    const [topic, setTopic] = useState("");
    const [goal, setGoal] = useState("");
    const [timeframe, setTimeframe] = useState("");
    const [dailyMinutes, setDailyMinutes] = useState(30);
    const [currentProblem, setCurrentProblem] = useState("");

    const allRequiredFilled =
        name.trim().length > 0 &&
        topic.trim().length > 0 &&
        goal.trim().length > 0 &&
        timeframe.trim().length > 0 &&
        dailyMinutes > 0;

    /**
     * v0.4.0 — "Later" / skip path. Creates a User row with the
     * detected browser language (or English) plus a generic
     * placeholder project, drops both ids in localStorage, and
     * lands on /dashboard. The Dashboard's empty-state cards
     * (no profile yet, zero sessions) already handle this
     * gracefully. The user can edit / refine the project from
     * the Curriculum page later.
     *
     * No fields required — the goal is for a curious visitor
     * to land in the app in two clicks.
     */
    const handleSkip = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const language = lang || defaultLanguageFromBrowser();
            const user = await getStorage().users.create({
                name: t("onboarding.skip_default_name", "Learner"),
                language,
            });
            setUserId(user.id);
            const project = await getStorage().users.projects.create(user.id, {
                topic: t("onboarding.skip_default_topic", "My learning"),
                goal: t(
                    "onboarding.skip_default_goal",
                    "Discover my learning style.",
                ),
                timeframe: t("onboarding.skip_default_timeframe", "Flexible"),
                daily_minutes: 30,
                current_problem: null,
                active: true,
            });
            setProjectId(project.id);
            notify.success(
                t("toast.onboarding_skipped", "Welcome! You can refine later."),
            );
            navigate("/dashboard");
        } catch (err) {
            const detail =
                err instanceof ApiError
                    ? err.detail
                    : t("common.error", "Something went wrong.");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting || !allRequiredFilled) return;
        setSubmitting(true);
        try {
            const user = await getStorage().users.create({name: name.trim(), language: lang});
            setUserId(user.id);
            const project = await getStorage().users.projects.create(user.id, {
                topic: topic.trim(),
                goal: goal.trim(),
                timeframe: timeframe.trim(),
                daily_minutes: dailyMinutes,
                current_problem: currentProblem.trim() || null,
                active: true,
            });
            setProjectId(project.id);
            notify.success(t("toast.project_created", "Project created."));
            navigate("/assessment");
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : t("common.error", "Something went wrong.");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main data-testid="onboarding" className="onboarding-page">
            <header className="onboarding-header">
                <div className="onboarding-header-row">
                    <h1>{t("onboarding.title", "Create a learning project")}</h1>
                    {/* Prominent skip affordance, visible above the
                        fold without scrolling. Sits at the top-right
                        of the header so a curious visitor can land in
                        the app in one click without filling the
                        6-field form below. The bottom "Later" button
                        is the same handler — kept for users who
                        scroll to the form actions. */}
                    <button
                        type="button"
                        className="btn btn-secondary onboarding-skip-top"
                        onClick={handleSkip}
                        disabled={submitting}
                        data-testid="onboarding-skip-top"
                    >
                        {t("onboarding.skip_top", "Skip for now →")}
                    </button>
                </div>
                <p className="onboarding-intro">{t("onboarding.intro")}</p>
            </header>

            <form className="onboarding-form" onSubmit={handleSubmit} noValidate>
                <label className="form-row">
                    <span className="form-label">
                        {t("onboarding.field_name", "Your name")}{" "}
                        <span className="form-required" aria-hidden="true">
                            *
                        </span>
                    </span>
                    <input
                        data-testid="onboarding-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        disabled={submitting}
                    />
                </label>

                <label className="form-row">
                    <span className="form-label">
                        {t("onboarding.field_topic", "Topic")}{" "}
                        <span className="form-required" aria-hidden="true">
                            *
                        </span>
                    </span>
                    <input
                        data-testid="onboarding-topic"
                        type="text"
                        required
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        disabled={submitting}
                    />
                    <span className="form-hint">{t("onboarding.field_topic_hint")}</span>
                </label>

                <label className="form-row">
                    <span className="form-label">
                        {t("onboarding.field_goal", "Goal")}{" "}
                        <span className="form-required" aria-hidden="true">
                            *
                        </span>
                    </span>
                    <textarea
                        data-testid="onboarding-goal"
                        required
                        rows={3}
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        disabled={submitting}
                    />
                    <span className="form-hint">{t("onboarding.field_goal_hint")}</span>
                </label>

                <label className="form-row">
                    <span className="form-label">
                        {t("onboarding.field_timeframe", "Time frame")}{" "}
                        <span className="form-required" aria-hidden="true">
                            *
                        </span>
                    </span>
                    <input
                        data-testid="onboarding-timeframe"
                        type="text"
                        required
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                        disabled={submitting}
                    />
                    <span className="form-hint">{t("onboarding.field_timeframe_hint")}</span>
                </label>

                <label className="form-row">
                    <span className="form-label">
                        {t("onboarding.field_daily_minutes", "Minutes per day")}{" "}
                        <span className="form-required" aria-hidden="true">
                            *
                        </span>
                    </span>
                    <input
                        data-testid="onboarding-daily-minutes"
                        type="number"
                        min={5}
                        max={600}
                        step={5}
                        required
                        value={dailyMinutes}
                        onChange={(e) => setDailyMinutes(Number(e.target.value) || 0)}
                        disabled={submitting}
                    />
                </label>

                <label className="form-row">
                    <span className="form-label">
                        {t("onboarding.field_current_problem", "Current problem")}{" "}
                        <span className="form-optional">
                            ({t("common.optional", "optional")})
                        </span>
                    </span>
                    <textarea
                        data-testid="onboarding-current-problem"
                        rows={2}
                        value={currentProblem}
                        onChange={(e) => setCurrentProblem(e.target.value)}
                        disabled={submitting}
                    />
                    <span className="form-hint">
                        {t("onboarding.field_current_problem_hint")}
                    </span>
                </label>

                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate("/")}
                        disabled={submitting}
                        data-testid="onboarding-back"
                    >
                        {t("common.back", "Back")}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleSkip}
                        disabled={submitting}
                        data-testid="onboarding-skip"
                    >
                        {t("onboarding.skip", "Later")}
                    </button>
                    <button
                        type="submit"
                        data-testid="onboarding-submit"
                        className="btn btn-primary"
                        disabled={!allRequiredFilled || submitting}
                    >
                        {submitting
                            ? t("onboarding.creating", "Creating project…")
                            : t("onboarding.submit", "Create project and start assessment")}
                    </button>
                </div>
                <p className="form-hint onboarding-skip-hint">
                    {t(
                        "onboarding.skip_hint",
                        "Not sure yet? Tap Later to jump in — you can fill this in from the Curriculum page anytime.",
                    )}
                </p>
            </form>
        </main>
    );
}
