import {useEffect, useMemo, useState, type FormEvent} from "react";
import {useNavigate} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {ApiError} from "../api/client";
import HelpLink from "../components/help/HelpLink";
import HelpTooltip from "../components/help/HelpTooltip";
import OnboardingWizard, {
    type WizardValues,
} from "../components/onboarding/OnboardingWizard";
import {useI18n} from "../hooks/useI18n";
import {setProjectId, setUserId} from "../lib/learnerState";
import {translateSubjectPath} from "../lib/subjectI18n";
import {suggestSubjects, type SubjectSuggestion} from "../lib/subjectSuggest";
import {getStorage} from "../storage";
import type {LearningProject, Subject} from "../types/domain";
import {notify} from "../utils/notify";

/** Default daily-practice minutes when the learner doesn't set one. */
const DEFAULT_DAILY_MINUTES = 15;

/** The three screens of the onboarding flow. */
type Phase = "form" | "invite" | "wizard";

/**
 * Onboarding page (project-reference §8 row ``/onboarding``).
 *
 * Three-phase, beginner-friendly flow:
 *
 *   1. **Quick start** (#92): name + topic are the ONLY required
 *      fields. Submitting creates the User + LearningProject with
 *      sensible defaults (goal "Learn {topic}", timeframe "Flexible",
 *      15 min/day) and assigns any picked subjects.
 *   2. **Invitation** (#94): "Want to set up your profile in more
 *      detail?" — "Jump right in" goes straight to the Dashboard;
 *      "Set up profile" opens the wizard.
 *   3. **Wizard** (#94): one optional question per screen (goal /
 *      timeframe / minutes / current problem), each pre-filled with a
 *      default, then an assessment offer. Finishing patches the project
 *      via ``projects.update`` and routes to /assessment or /dashboard.
 *
 * No Skip / Later button — the required form is short enough not to
 * need one.
 */
export default function Onboarding() {
    const {t, lang} = useI18n();
    const navigate = useNavigate();
    const [phase, setPhase] = useState<Phase>("form");
    const [submitting, setSubmitting] = useState(false);

    const [name, setName] = useState("");
    const [topic, setTopic] = useState("");
    const [createdProject, setCreatedProject] = useState<LearningProject | null>(
        null,
    );

    // v22F — Subject picker (contextual to the topic).
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(
        new Set(),
    );

    useEffect(() => {
        let cancelled = false;
        // Wrap in Promise.resolve so a synchronous throw (e.g.
        // storage layer not wired) is captured by the .catch
        // instead of bubbling up as an unhandled rejection. Subject
        // suggestions are a nice-to-have; the page must not break
        // when subject seeding hasn't run yet.
        Promise.resolve()
            .then(() => getStorage().subjects.list())
            .then((rows) => {
                if (!cancelled) setSubjects(rows);
            })
            .catch(() => {
                /* no-op; suggestions just stay empty */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const suggestions: SubjectSuggestion[] = useMemo(
        () => suggestSubjects(topic, subjects, 5),
        [topic, subjects],
    );

    function toggleSubject(subjectId: string) {
        setSelectedSubjectIds((prev) => {
            const next = new Set(prev);
            if (next.has(subjectId)) next.delete(subjectId);
            else next.add(subjectId);
            return next;
        });
    }

    /**
     * Assign every picked subject to the new project. Failures here do
     * not block onboarding — they soft-fail so a partial taxonomy
     * assignment never traps the learner before the next screen.
     */
    async function assignSubjects(projectId: string) {
        const storage = getStorage();
        for (const subjectId of selectedSubjectIds) {
            try {
                await storage.projectTaxonomy.assignSubject(projectId, subjectId);
            } catch {
                /* soft-fail */
            }
        }
    }

    const allRequiredFilled =
        name.trim().length > 0 && topic.trim().length > 0;

    const defaultTimeframe = t("onboarding.wizard.timeframe_flexible", "Flexible");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting || !allRequiredFilled) return;
        setSubmitting(true);
        try {
            const trimmedTopic = topic.trim();
            // Only name + topic are required; the backend's
            // LearningProjectCreate still requires a non-empty goal +
            // timeframe, so the project is created with defaults the
            // wizard can later refine.
            const defaultGoal = t(
                "onboarding.default_goal",
                "Learn {topic}",
            ).replace("{topic}", trimmedTopic);
            const user = await getStorage().users.create({name: name.trim(), language: lang});
            setUserId(user.id);
            const project = await getStorage().users.projects.create(user.id, {
                topic: trimmedTopic,
                goal: defaultGoal,
                timeframe: defaultTimeframe,
                daily_minutes: DEFAULT_DAILY_MINUTES,
                current_problem: null,
                active: true,
            });
            setProjectId(project.id);
            await assignSubjects(project.id);
            setCreatedProject(project);
            notify.success(t("toast.project_created", "Project created."));
            setPhase("invite");
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : t("common.error", "Something went wrong.");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    };

    /**
     * Persist the wizard's refined values onto the already-created
     * project, then route. Goal / current problem are only sent when
     * non-empty (the backend rejects an empty goal); timeframe +
     * minutes always carry a value.
     */
    const handleWizardFinish = async (
        values: WizardValues,
        startAssessment: boolean,
    ) => {
        if (submitting || !createdProject) return;
        setSubmitting(true);
        try {
            const trimmedGoal = values.goal.trim();
            const trimmedProblem = values.currentProblem.trim();
            await getStorage().projects.update(createdProject.id, {
                timeframe: values.timeframe,
                daily_minutes: values.dailyMinutes,
                ...(trimmedGoal ? {goal: trimmedGoal} : {}),
                ...(trimmedProblem ? {current_problem: trimmedProblem} : {}),
            });
            navigate(startAssessment ? "/assessment" : "/dashboard");
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : t("common.error", "Something went wrong.");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    };

    if (phase === "invite") {
        return (
            <main
                id="main"
                data-testid="onboarding-invite"
                className="onboarding-page"
            >
                <div className="mx-auto flex w-full max-w-xl flex-col gap-6 text-center">
                    <h1>
                        {t(
                            "onboarding.invite_title",
                            "Want to set up your learning profile in more detail?",
                        )}
                    </h1>
                    <p className="onboarding-intro">
                        {t(
                            "onboarding.invite_subtitle",
                            "It takes a minute and tailors your sessions — you can also do it later.",
                        )}
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <Button
                            type="button"
                            variant="default"
                            onClick={() => navigate("/dashboard")}
                            disabled={submitting}
                            data-testid="onboarding-invite-start-now"
                        >
                            {t("onboarding.invite_start_now", "Jump right in")}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setPhase("wizard")}
                            disabled={submitting}
                            data-testid="onboarding-invite-setup-profile"
                        >
                            {t("onboarding.invite_setup_profile", "Set up profile")}
                        </Button>
                    </div>
                </div>
            </main>
        );
    }

    if (phase === "wizard" && createdProject) {
        return (
            <main
                id="main"
                data-testid="onboarding-wizard-page"
                className="onboarding-page"
            >
                <OnboardingWizard
                    defaults={{
                        goal: "",
                        timeframe: createdProject.timeframe || defaultTimeframe,
                        dailyMinutes:
                            createdProject.daily_minutes || DEFAULT_DAILY_MINUTES,
                        currentProblem: "",
                    }}
                    onFinish={handleWizardFinish}
                    onExit={() => setPhase("invite")}
                    busy={submitting}
                />
            </main>
        );
    }

    return (
        <main id="main" data-testid="onboarding" className="onboarding-page">
            <header className="onboarding-header">
                <h1>{t("onboarding.title", "Create a learning project")}</h1>
                <p className="onboarding-intro">{t("onboarding.intro")}</p>
                <p
                    className="onboarding-intro"
                    data-testid="onboarding-concepts-explainer"
                >
                    {t("onboarding.concepts_explainer_prefix", "You'll define a ")}
                    <HelpTooltip glossaryKey="learning_project">
                        {t(
                            "onboarding.term_learning_project",
                            "learning project",
                        )}
                    </HelpTooltip>
                    {t(
                        "onboarding.concepts_explainer_mid1",
                        ", then complete a brief assessment to build a ",
                    )}
                    <HelpTooltip glossaryKey="learning_profile">
                        {t(
                            "onboarding.term_learning_profile",
                            "learning profile",
                        )}
                    </HelpTooltip>
                    {t(
                        "onboarding.concepts_explainer_mid2",
                        " — which guides every ",
                    )}
                    <HelpTooltip glossaryKey="learning_session">
                        {t(
                            "onboarding.term_learning_session",
                            "learning session",
                        )}
                    </HelpTooltip>
                    {t("onboarding.concepts_explainer_suffix", " ahead.")}
                </p>
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
                        <HelpLink glossaryKey="learning_project" />
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

                {suggestions.length > 0 && (
                    <div
                        className="onboarding-subject-suggestions"
                        data-testid="onboarding-subject-suggestions"
                    >
                        <p className="form-label">
                            {t(
                                "onboarding.subject_suggestions",
                                "Suggested subjects (tap to assign):",
                            )}
                        </p>
                        <ul className="taxonomy-chip-list">
                            {suggestions.map((suggestion) => {
                                const isOn = selectedSubjectIds.has(
                                    suggestion.subject.id,
                                );
                                return (
                                    <li key={suggestion.subject.id}>
                                        <button
                                            type="button"
                                            className={`tag-badge${isOn ? " tag-badge-selected" : ""}`}
                                            data-testid={`onboarding-subject-suggestion-${suggestion.subject.id}`}
                                            onClick={() =>
                                                toggleSubject(suggestion.subject.id)
                                            }
                                            disabled={submitting}
                                        >
                                            {translateSubjectPath(
                                                suggestion.path,
                                                t,
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                <div className="form-actions">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => navigate("/")}
                        disabled={submitting}
                        data-testid="onboarding-back"
                    >
                        {t("common.back", "Back")}
                    </Button>
                    <Button
                        type="submit"
                        data-testid="onboarding-submit"
                        variant="default"
                        disabled={!allRequiredFilled || submitting}
                    >
                        {submitting
                            ? t("onboarding.creating", "Creating project…")
                            : t("onboarding.submit", "Create project and start assessment")}
                    </Button>
                </div>
            </form>
        </main>
    );
}
