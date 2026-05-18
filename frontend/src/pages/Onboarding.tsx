import {useState, type FormEvent} from "react";
import {useNavigate} from "react-router-dom";

import {api, ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {setProjectId, setUserId} from "../lib/learnerState";
import {notify} from "../utils/notify";

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

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting || !allRequiredFilled) return;
        setSubmitting(true);
        try {
            const user = await api.users.create({name: name.trim(), language: lang});
            setUserId(user.id);
            const project = await api.users.projects.create(user.id, {
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
                <h1>{t("onboarding.title", "Create a learning project")}</h1>
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
            </form>
        </main>
    );
}
