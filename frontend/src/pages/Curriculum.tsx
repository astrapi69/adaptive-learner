import {useCallback, useEffect, useState, type FormEvent} from "react";
import {useNavigate} from "react-router-dom";

import AddTopicDialog from "../components/AddTopicDialog";
import LessonList from "../components/LessonList";
import TopicTree from "../components/TopicTree";
import {ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {readLearnerState} from "../lib/learnerState";
import {getStorage} from "../storage";
import {notify} from "../utils/notify";
import type {Curriculum, LearningTopic, Lesson} from "../types";

/**
 * Curriculum page (project-reference §8 v0.2.0 addition,
 * /curriculum).
 *
 * Per-user CRUD over the curriculum + topic tree:
 *
 *   1. Mount: read user_id from localStorage; redirect to
 *      /onboarding if missing. List the user's curricula via
 *      GET /api/users/{user_id}/curricula; auto-select the
 *      first one (or expose the create dialog if zero exist).
 *   2. For the selected curriculum, load topics via
 *      GET /api/curricula/{id}/topics and render the forest
 *      with TopicTree (uses TypedTreeNode + buildTreeFromFlat).
 *   3. CRUD: add-root, add-subtopic, rename, delete via the
 *      AddTopicDialog modal + the per-node action buttons.
 */
type DialogMode =
    | {kind: "closed"}
    | {kind: "add-root"}
    | {kind: "add-sub"; parentId: string}
    | {kind: "rename"; topicId: string; initialTitle: string};

export default function Curriculum() {
    const {t} = useI18n();
    const navigate = useNavigate();

    const [curricula, setCurricula] = useState<Curriculum[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [topics, setTopics] = useState<LearningTopic[]>([]);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dialog, setDialog] = useState<DialogMode>({kind: "closed"});
    const [submitting, setSubmitting] = useState(false);
    const [creatingCurriculum, setCreatingCurriculum] = useState(false);
    const [newCurriculumTitle, setNewCurriculumTitle] = useState("");

    const reloadTopics = useCallback(async (curriculumId: string) => {
        try {
            const fresh = await getStorage().curricula.listTopics(curriculumId);
            setTopics(fresh);
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : "Failed to load topics.";
            notify.error(detail);
        }
    }, []);

    const reloadLessons = useCallback(async (curriculumId: string) => {
        try {
            const fresh = await getStorage().curricula.listLessons(curriculumId);
            setLessons(fresh);
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : "Failed to load lessons.";
            notify.error(detail);
        }
    }, []);

    const handleCreateLesson = async (title: string) => {
        if (!selectedId || submitting) return;
        setSubmitting(true);
        try {
            await getStorage().curricula.createLesson(selectedId, {title});
            await reloadLessons(selectedId);
            notify.success(t("curriculum.lesson_created", "Lesson created."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateLesson = async (
        lessonId: string,
        title: string,
        content: string,
    ) => {
        if (!selectedId || submitting) return;
        setSubmitting(true);
        try {
            await getStorage().lessons.update(lessonId, {title, content});
            await reloadLessons(selectedId);
            notify.success(t("curriculum.lesson_saved", "Lesson saved."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteLesson = async (lessonId: string) => {
        if (!selectedId || submitting) return;
        const ok = window.confirm(
            t("curriculum.lesson_delete_confirm", "Delete this lesson?"),
        );
        if (!ok) return;
        setSubmitting(true);
        try {
            await getStorage().lessons.remove(lessonId);
            await reloadLessons(selectedId);
            notify.success(t("curriculum.lesson_deleted", "Lesson deleted."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    };

    // Bootstrap: load curricula on mount.
    useEffect(() => {
        const userId = readLearnerState().userId;
        if (!userId) {
            navigate("/onboarding", {replace: true});
            return;
        }
        let cancelled = false;
        getStorage().curricula
            .list(userId)
            .then((list) => {
                if (cancelled) return;
                setCurricula(list);
                if (list.length > 0) {
                    setSelectedId(list[0].id);
                }
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                const detail =
                    err instanceof ApiError ? err.detail : t("common.error");
                setError(detail);
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    // Load topics + lessons whenever the selected curriculum
    // changes.
    useEffect(() => {
        if (!selectedId) {
            setTopics([]);
            setLessons([]);
            return;
        }
        void reloadTopics(selectedId);
        void reloadLessons(selectedId);
    }, [selectedId, reloadTopics, reloadLessons]);

    const handleCreateCurriculum = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const title = newCurriculumTitle.trim();
        if (!title || creatingCurriculum) return;
        const userId = readLearnerState().userId;
        if (!userId) return;
        setCreatingCurriculum(true);
        try {
            const created = await getStorage().curricula.create(userId, {title});
            setCurricula((prev) => [...prev, created]);
            setSelectedId(created.id);
            setNewCurriculumTitle("");
            notify.success(t("curriculum.created", "Curriculum created."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setCreatingCurriculum(false);
        }
    };

    const handleDialogSubmit = async (title: string) => {
        if (!selectedId || submitting) return;
        setSubmitting(true);
        try {
            if (dialog.kind === "add-root") {
                await getStorage().curricula.createTopic(selectedId, {
                    title,
                    parent_id: null,
                });
            } else if (dialog.kind === "add-sub") {
                await getStorage().curricula.createTopic(selectedId, {
                    title,
                    parent_id: dialog.parentId,
                });
            } else if (dialog.kind === "rename") {
                await getStorage().topics.update(dialog.topicId, {title});
            }
            await reloadTopics(selectedId);
            setDialog({kind: "closed"});
            notify.success(t("curriculum.saved", "Saved."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (topicId: string) => {
        if (!selectedId || submitting) return;
        const ok = window.confirm(
            t(
                "curriculum.delete_confirm",
                "Delete this topic? Its children stay as their own roots.",
            ),
        );
        if (!ok) return;
        setSubmitting(true);
        try {
            await getStorage().topics.remove(topicId);
            await reloadTopics(selectedId);
            notify.success(t("curriculum.deleted", "Topic deleted."));
        } catch (err) {
            const detail = err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <main data-testid="curriculum-loading" className="dashboard-page">
                <p className="muted">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    if (error) {
        return (
            <main data-testid="curriculum-error" className="dashboard-page">
                <p className="error-text">{error}</p>
            </main>
        );
    }

    return (
        <main data-testid="curriculum" className="dashboard-page">
            <header className="dashboard-header">
                <h1>{t("curriculum.title", "Curriculum")}</h1>
            </header>

            {/* Curriculum picker + create form. The picker stays
             *  hidden when there's only one or zero curricula —
             *  the dropdown would add visual noise without
             *  helping the user. */}
            <section className="curriculum-toolbar">
                {curricula.length > 1 && (
                    <label className="form-row">
                        <span className="form-label">
                            {t("curriculum.active", "Active curriculum")}
                        </span>
                        <select
                            data-testid="curriculum-select"
                            value={selectedId ?? ""}
                            onChange={(e) => setSelectedId(e.target.value)}
                        >
                            {curricula.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.title}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <form
                    className="curriculum-create-form"
                    onSubmit={handleCreateCurriculum}
                >
                    <input
                        type="text"
                        data-testid="curriculum-new-title"
                        value={newCurriculumTitle}
                        onChange={(e) => setNewCurriculumTitle(e.target.value)}
                        placeholder={t(
                            "curriculum.new_placeholder",
                            "New curriculum title…",
                        )}
                        disabled={creatingCurriculum}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary"
                        data-testid="curriculum-create"
                        disabled={
                            creatingCurriculum || newCurriculumTitle.trim().length === 0
                        }
                    >
                        {t("curriculum.create", "Create curriculum")}
                    </button>
                </form>
            </section>

            {selectedId ? (
                <section className="dashboard-card dashboard-card-wide">
                    <div className="curriculum-tree-head">
                        <h2 className="dashboard-card-title">
                            {curricula.find((c) => c.id === selectedId)?.title ?? ""}
                        </h2>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            data-testid="curriculum-add-root"
                            onClick={() => setDialog({kind: "add-root"})}
                        >
                            {t("curriculum.add_root_topic", "Add root topic")}
                        </button>
                    </div>
                    {topics.length === 0 ? (
                        <p className="muted" data-testid="curriculum-empty">
                            {t(
                                "curriculum.no_topics",
                                "No topics yet — add your first to get started.",
                            )}
                        </p>
                    ) : (
                        <TopicTree
                            topics={topics}
                            onAddSubtopic={(parentId) =>
                                setDialog({kind: "add-sub", parentId})
                            }
                            onRename={(topicId, currentTitle) =>
                                setDialog({
                                    kind: "rename",
                                    topicId,
                                    initialTitle: currentTitle,
                                })
                            }
                            onDelete={handleDelete}
                        />
                    )}
                </section>
            ) : null}

            {selectedId && (
                <section className="dashboard-card dashboard-card-wide">
                    <h2 className="dashboard-card-title">
                        {t("curriculum.lessons_title", "Lessons")}
                    </h2>
                    <LessonList
                        lessons={lessons}
                        onCreate={handleCreateLesson}
                        onUpdate={handleUpdateLesson}
                        onDelete={handleDeleteLesson}
                        submitting={submitting}
                    />
                </section>
            )}

            {!selectedId ? (
                <p className="muted" data-testid="curriculum-no-selection">
                    {t(
                        "curriculum.no_curriculum",
                        "Create a curriculum to start building a topic tree.",
                    )}
                </p>
            ) : null}

            <AddTopicDialog
                open={dialog.kind !== "closed"}
                initialTitle={dialog.kind === "rename" ? dialog.initialTitle : ""}
                titleKey={
                    dialog.kind === "rename"
                        ? "curriculum.rename_topic"
                        : dialog.kind === "add-sub"
                          ? "curriculum.add_subtopic"
                          : "curriculum.add_topic"
                }
                onCancel={() => setDialog({kind: "closed"})}
                onSubmit={handleDialogSubmit}
                submitting={submitting}
            />
        </main>
    );
}
