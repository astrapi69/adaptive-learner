import {useEffect, useMemo, useState, type FormEvent} from "react";
import {useNavigate} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {ApiError} from "../api/client";
import HelpLink from "../components/help/HelpLink";
import HelpTooltip from "../components/help/HelpTooltip";
import {useI18n} from "../hooks/useI18n";
import {setProjectId, setUserId} from "../lib/learnerState";
import {translateSubjectPath} from "../lib/subjectI18n";
import {suggestSubjects, type SubjectSuggestion} from "../lib/subjectSuggest";
import {getStorage} from "../storage";
import type {Subject} from "../types/domain";
import {notify} from "../utils/notify";

/** Default daily-practice minutes when the learner doesn't set one. */
const DEFAULT_DAILY_MINUTES = 15;

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
 * Beginner-friendly (#92): only **name + topic** are required — enough
 * to create a project and start. Goal / time frame / minutes-per-day /
 * current problem / tags live in a collapsed "More details" disclosure
 * and fall back to sensible defaults (the backend's
 * ``LearningProjectCreate`` requires ``goal`` / ``timeframe`` non-empty,
 * so the defaults are applied at submit time rather than sent empty).
 * There is no Skip / Later button — the required form is short enough
 * that one isn't needed.
 */
export default function Onboarding() {
    const {t, lang} = useI18n();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);

    const [name, setName] = useState("");
    const [topic, setTopic] = useState("");
    const [goal, setGoal] = useState("");
    const [timeframe, setTimeframe] = useState("");
    const [dailyMinutes, setDailyMinutes] = useState(DEFAULT_DAILY_MINUTES);
    const [currentProblem, setCurrentProblem] = useState("");

    // v22F — Subject + Tag picker.
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(
        new Set(),
    );
    const [tagInput, setTagInput] = useState("");

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

    function parseTagInput(value: string): string[] {
        return value
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
    }

    /**
     * After the project + user are created, assign every picked
     * subject + create-and-assign every entered tag. Failures here
     * do not block onboarding — surface a soft toast and continue
     * to the next page so a partial taxonomy assignment never
     * traps the user before the Assessment.
     */
    async function applyTaxonomy(userId: string, projectId: string) {
        const storage = getStorage();
        for (const subjectId of selectedSubjectIds) {
            try {
                await storage.projectTaxonomy.assignSubject(projectId, subjectId);
            } catch {
                /* soft-fail; surfaced once below */
            }
        }
        const tagNames = parseTagInput(tagInput);
        for (const tagName of tagNames) {
            try {
                let tag;
                try {
                    tag = await storage.tags.create(userId, {name: tagName});
                } catch (err) {
                    // 409 means the tag already exists for this
                    // user — re-fetch the list to find its id.
                    if (err instanceof ApiError && err.status === 409) {
                        const existing = await storage.tags.list(userId);
                        tag = existing.find((t) => t.name === tagName);
                    } else {
                        throw err;
                    }
                }
                if (tag) {
                    await storage.projectTaxonomy.assignTag(projectId, tag.id);
                }
            } catch {
                /* soft-fail */
            }
        }
    }

    const allRequiredFilled =
        name.trim().length > 0 && topic.trim().length > 0;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting || !allRequiredFilled) return;
        setSubmitting(true);
        try {
            const trimmedTopic = topic.trim();
            // Only name + topic are required; the backend's
            // LearningProjectCreate still requires a non-empty goal +
            // timeframe, so apply sensible defaults when the learner
            // skipped the optional "More details" section.
            const resolvedGoal =
                goal.trim() ||
                t("onboarding.default_goal", "Learn {topic}").replace(
                    "{topic}",
                    trimmedTopic,
                );
            const resolvedTimeframe =
                timeframe.trim() ||
                t("onboarding.default_timeframe", "Flexible");
            const resolvedDailyMinutes =
                dailyMinutes > 0 ? dailyMinutes : DEFAULT_DAILY_MINUTES;
            const user = await getStorage().users.create({name: name.trim(), language: lang});
            setUserId(user.id);
            const project = await getStorage().users.projects.create(user.id, {
                topic: trimmedTopic,
                goal: resolvedGoal,
                timeframe: resolvedTimeframe,
                daily_minutes: resolvedDailyMinutes,
                current_problem: currentProblem.trim() || null,
                active: true,
            });
            setProjectId(project.id);
            await applyTaxonomy(user.id, project.id);
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

                <details
                    className="onboarding-more-details"
                    data-testid="onboarding-more-details"
                >
                    <summary className="onboarding-more-details-summary flex min-h-11 cursor-pointer select-none items-center font-medium">
                        {t("onboarding.more_details", "More details (optional)")}
                    </summary>

                <label className="form-row">
                    <span className="form-label">
                        {t("onboarding.field_tags", "Tags")}{" "}
                        <span className="form-optional">
                            ({t("common.optional", "optional")})
                        </span>
                    </span>
                    <input
                        data-testid="onboarding-tags"
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder={t(
                            "onboarding.field_tags_placeholder",
                            "exam-prep, daily-practice",
                        )}
                        disabled={submitting}
                    />
                    <span className="form-hint">
                        {t(
                            "onboarding.field_tags_hint",
                            "Comma-separated. Reuse existing tags or create new ones on the fly.",
                        )}
                    </span>
                </label>

                <label className="form-row">
                    <span className="form-label">
                        {t("onboarding.field_goal", "Goal")}{" "}
                        <span className="form-optional">
                            ({t("common.optional", "optional")})
                        </span>
                    </span>
                    <textarea
                        data-testid="onboarding-goal"
                        rows={3}
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder={t(
                            "onboarding.default_goal",
                            "Learn {topic}",
                        ).replace("{topic}", topic.trim() || "…")}
                        disabled={submitting}
                    />
                    <span className="form-hint">{t("onboarding.field_goal_hint")}</span>
                </label>

                <label className="form-row">
                    <span className="form-label">
                        {t("onboarding.field_timeframe", "Time frame")}{" "}
                        <span className="form-optional">
                            ({t("common.optional", "optional")})
                        </span>
                    </span>
                    <input
                        data-testid="onboarding-timeframe"
                        type="text"
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                        placeholder={t("onboarding.default_timeframe", "Flexible")}
                        disabled={submitting}
                    />
                    <span className="form-hint">{t("onboarding.field_timeframe_hint")}</span>
                </label>

                <label className="form-row">
                    <span className="form-label">
                        {t("onboarding.field_daily_minutes", "Minutes per day")}{" "}
                        <span className="form-optional">
                            ({t("common.optional", "optional")})
                        </span>
                    </span>
                    <input
                        data-testid="onboarding-daily-minutes"
                        type="number"
                        min={5}
                        max={600}
                        step={5}
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
                </details>

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
