import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type FormEvent,
} from "react";
import {useNavigate} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {ApiError} from "../../api/client";
import HelpLink from "../../components/help/HelpLink";
import HelpTooltip from "../../components/help/HelpTooltip";
import OnboardingWizard, {
    type WizardValues,
} from "../../components/onboarding/OnboardingWizard";
import MigrationWelcomeDialog from "../../components/onboarding/MigrationWelcomeDialog";
import {useI18n} from "../../hooks/ui/useI18n";
import {isEmptyInstall, pickAdoptedIdentity} from "../../lib/backup/firstRunRestore";
import {isMigrationOffered, markMigrationOffered} from "../../lib/backup/migrationFlag";
import {readBackupFile} from "../../lib/backup/validateBackupFile";
import {applyLocalStorageSnapshot} from "../../lib/backup/localStorageSnapshot";
import {SHARE_URL} from "../../lib/share/generate-share-text";
import {
    readLearnerState,
    setLanguage,
    setProjectId,
    setUserId,
} from "../../lib/learning/learnerState";
import {translateSubjectPath} from "../../lib/i18n/subjectI18n";
import {suggestSubjects, type SubjectSuggestion} from "../../lib/learning/subjectSuggest";
import {getStorage} from "../../storage";
import type {LearningProject, Subject} from "../../types/domain";
import {notify} from "../../utils/notify";

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

    // #150 — first-run restore: the "Restore from backup" affordance
    // only shows on an empty install and runs its own identity-adopting
    // import (see lib/firstRunRestore.ts).
    const restoreInputRef = useRef<HTMLInputElement>(null);
    const [emptyInstall, setEmptyInstall] = useState(false);
    const [restoring, setRestoring] = useState(false);

    // #1085 — online-to-local migration: on a fresh LOCAL (API mode) install
    // offer to bring over data from the online (GitHub Pages) version via the
    // existing backup. localStorage-gated so it is offered once per device.
    const storageMode = getStorage().mode;
    const [migrationOffered, setMigrationOffered] = useState(isMigrationOffered);
    const showMigration =
        storageMode === "api" && emptyInstall && !migrationOffered;

    const dismissMigration = () => {
        markMigrationOffered();
        setMigrationOffered(true);
    };
    const openOnlineVersion = () => {
        window.open(SHARE_URL, "_blank", "noopener,noreferrer");
    };

    useEffect(() => {
        let cancelled = false;
        isEmptyInstall(getStorage(), readLearnerState().userId)
            .then((empty) => {
                if (!cancelled) setEmptyInstall(empty);
            })
            .catch(() => {
                /* leave the restore affordance hidden on failure */
            });
        return () => {
            cancelled = true;
        };
    }, []);

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
            // ``replace`` so the browser back button can't return to this
            // now-stale onboarding page — its phase resets to the
            // name/topic form on remount, which would look like the
            // just-created project was lost (#171). The assessment carries
            // a ``backTo`` so its first-step "Continue later" exit returns
            // to the Dashboard, where it can be resumed.
            if (startAssessment) {
                navigate("/assessment", {
                    replace: true,
                    state: {backTo: "/dashboard"},
                });
            } else {
                navigate("/dashboard", {replace: true});
            }
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : t("common.error", "Something went wrong.");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    };

    /**
     * First-run restore (#150). Reads a backup file, adopts the
     * backup's identity (so the user-scoped restore actually lands on
     * an empty install), merges it via ``backup.import``, then routes
     * to the Dashboard. Storage-mode agnostic.
     */
    const handleRestoreFile = async (
        event: ChangeEvent<HTMLInputElement>,
    ) => {
        const input = event.target;
        const file = input.files?.[0];
        // Reset so picking the same file twice in a row re-fires.
        input.value = "";
        if (!file || restoring) return;
        setRestoring(true);
        try {
            // Validate the picked file as an Adaptive Learner backup
            // BEFORE attempting the import (#640/#642). Any non-backup
            // file (wrong/missing ``format`` marker, not JSON, a non-object
            // like 42/"x"/[]/null, a truncated download, an over-large
            // file) is a user mistake — they picked the wrong file — not an
            // app fault. ``readBackupFile`` returns a typed result and
            // never throws; surface a gentle, auto-dismissing ``warning``
            // (no "Report Issue" button) instead of an error toast that
            // reads like a bug.
            const result = await readBackupFile(file);
            if (!result.ok) {
                notify.warning(
                    result.error === "too_large"
                        ? t(
                              "backup.too_large",
                              "This backup file is too large (over 100 MB).",
                          )
                        : t(
                              "backup.not_a_backup_file",
                              "This file is not a valid backup file. Please choose a file exported with 'Create backup'.",
                          ),
                );
                return;
            }
            const payload = result.payload;
            // A well-formed backup always carries a resolvable owning user;
            // a payload without one cannot be restored onto a fresh install.
            const identity = pickAdoptedIdentity(payload);
            if (identity.userId === "") {
                notify.warning(
                    t(
                        "backup.not_a_backup_file",
                        "This file is not a valid backup file. Please choose a file exported with 'Create backup'.",
                    ),
                );
                return;
            }
            // Adopt the backup's identity BEFORE importing so the
            // user-scoped restore matches every row.
            setUserId(identity.userId);
            if (identity.projectId) setProjectId(identity.projectId);
            if (identity.language) setLanguage(identity.language);
            const summary = await getStorage().backup.import(
                identity.userId,
                payload,
            );
            // Restore the localStorage snapshot (preferences + contributions)
            // frontend-side. Legacy backups carry none -> no-op.
            applyLocalStorageSnapshot(payload.local_storage);
            // #126 parity — surface the round-trip in the console so a
            // real restore is debuggable without a backend log.
            // eslint-disable-next-line no-console -- #126: intentional round-trip trace for backend-less debugging
            console.log("[Backup] First-run restore result:", summary);
            if (summary.errors.length > 0) {
                console.error("[Backup] First-run restore errors:", summary.errors);
            }
            // #1085 — a restore (incl. an online-to-local migration) means the
            // welcome offer is done; don't prompt again on this device.
            markMigrationOffered();
            notify.success(
                t("onboarding.restore_success", "Backup restored. Welcome back!"),
            );
            navigate("/dashboard", {replace: true});
        } catch (err) {
            // Reached only when a VALID Adaptive Learner backup failed to
            // import — a genuine, unexpected failure worth reporting, so
            // the error toast (with "Report Issue") is the right surface.
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                t(
                    "backup.import_parse_error",
                    "Could not read backup: {{detail}}",
                ).replace("{{detail}}", detail),
            );
        } finally {
            setRestoring(false);
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
                            onClick={() => navigate("/dashboard", {replace: true})}
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
                        {/* tabIndex=-1 so Tab flows Name -> Topic input
                            instead of catching focus on this icon, which
                            sits between the two inputs in the DOM (#175).
                            Still clickable; the same term is keyboard-
                            reachable via the intro paragraph's tooltip. */}
                        <HelpLink glossaryKey="learning_project" tabIndex={-1} />
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

            {emptyInstall && (
                <section
                    className="mt-6 flex flex-col items-center gap-3 text-center"
                    data-testid="onboarding-restore"
                >
                    <p className="onboarding-intro">
                        {t(
                            "onboarding.restore_hint",
                            "Already learning with Adaptive Learner? Restore from a backup.",
                        )}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        data-testid="onboarding-restore-backup"
                        onClick={() => restoreInputRef.current?.click()}
                        disabled={restoring || submitting}
                    >
                        {restoring
                            ? t("onboarding.restoring", "Restoring…")
                            : t(
                                  "onboarding.restore_backup",
                                  "Restore from existing backup",
                              )}
                    </Button>
                    <input
                        ref={restoreInputRef}
                        type="file"
                        accept=".alb,.json,application/zip,application/json"
                        onChange={handleRestoreFile}
                        style={{display: "none"}}
                        data-testid="onboarding-restore-input"
                    />
                </section>
            )}

            <MigrationWelcomeDialog
                open={showMigration}
                importing={restoring}
                labels={{
                    title: t(
                        "migration.title",
                        "Bring your data from the online version",
                    ),
                    body: t(
                        "migration.body",
                        "Have you used Adaptive Learner online? Bring your learning data over with a backup file. No account needed.",
                    ),
                    hint: t(
                        "migration.hint",
                        "In the online version: Settings, Data, Create backup, download the .alb file, then import it here.",
                    ),
                    importLabel: t("migration.action.import", "Import backup"),
                    importing: t("onboarding.restoring", "Restoring…"),
                    openOnline: t(
                        "migration.action.open_online",
                        "Open online version",
                    ),
                    startFresh: t(
                        "migration.action.start_fresh",
                        "Start without data",
                    ),
                    close: t("common.close", "Close"),
                }}
                onImport={() => restoreInputRef.current?.click()}
                onOpenOnline={openOnlineVersion}
                onStartFresh={dismissMigration}
            />
        </main>
    );
}
