/**
 * ProjectTaxonomy (Phase 22D).
 *
 * Per-project taxonomy assignment UI:
 *  - lists currently-assigned Subjects + Tags as removable chips
 *  - exposes an "Assign subject" picker (compact subject browser)
 *  - exposes an "Assign tag" multi-select chip-cloud
 *
 * Self-contained: owns the lookups for assigned-subjects,
 * assigned-tags, and all-user-tags. Re-fetches after every
 * assign/unassign so the chip list stays current.
 */

import {useEffect, useState} from "react";

import {useButtonTooltips} from "../hooks/useButtonTooltips";
import {useI18n} from "../hooks/useI18n";
import {getStorage} from "../storage";
import type {Subject, Tag} from "../types/domain";
import {notify} from "../utils/notify";

import SubjectBrowser from "./SubjectBrowser";

interface ProjectTaxonomyProps {
    projectId: string;
    userId: string;
}

const DEFAULT_COLOR = "#6366f1";

export default function ProjectTaxonomy({
    projectId,
    userId,
}: ProjectTaxonomyProps) {
    const {t} = useI18n();
    const tooltipsOn = useButtonTooltips();
    const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);
    const [assignedTags, setAssignedTags] = useState<Tag[]>([]);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSubjectPicker, setShowSubjectPicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newTagName, setNewTagName] = useState("");

    async function refresh() {
        setLoading(true);
        try {
            const storage = getStorage();
            const [subs, tags, userTags] = await Promise.all([
                storage.projectTaxonomy.listSubjects(projectId),
                storage.projectTaxonomy.listTags(projectId),
                storage.tags.list(userId),
            ]);
            setAssignedSubjects(subs);
            setAssignedTags(tags);
            setAllTags(userTags);
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.load_failed", "Failed to load taxonomy."),
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void refresh();
    }, [projectId, userId]);

    async function handleAssignSubject(subjectId: string | null) {
        if (!subjectId) return;
        setSubmitting(true);
        try {
            await getStorage().projectTaxonomy.assignSubject(projectId, subjectId);
            notify.success(t("taxonomy.subject_assigned", "Subject assigned."));
            setShowSubjectPicker(false);
            await refresh();
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.assign_failed", "Could not assign subject."),
            );
        } finally {
            setSubmitting(false);
        }
    }

    async function handleUnassignSubject(subjectId: string) {
        setSubmitting(true);
        try {
            await getStorage().projectTaxonomy.unassignSubject(
                projectId,
                subjectId,
            );
            await refresh();
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.unassign_failed", "Could not unassign."),
            );
        } finally {
            setSubmitting(false);
        }
    }

    async function handleToggleTag(tag: Tag) {
        setSubmitting(true);
        try {
            const isAssigned = assignedTags.some((t) => t.id === tag.id);
            if (isAssigned) {
                await getStorage().projectTaxonomy.unassignTag(projectId, tag.id);
            } else {
                await getStorage().projectTaxonomy.assignTag(projectId, tag.id);
            }
            await refresh();
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.toggle_tag_failed", "Could not toggle tag."),
            );
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCreateAndAssignTag() {
        const trimmed = newTagName.trim();
        if (!trimmed) return;
        setSubmitting(true);
        try {
            const storage = getStorage();
            const tag = await storage.tags.create(userId, {name: trimmed});
            await storage.projectTaxonomy.assignTag(projectId, tag.id);
            notify.success(t("taxonomy.tag_added_assigned", "Tag created + assigned."));
            setNewTagName("");
            await refresh();
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.tag_create_failed", "Could not create tag."),
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div
                className="project-taxonomy"
                data-testid="project-taxonomy-loading"
            >
                {t("taxonomy.loading", "Loading…")}
            </div>
        );
    }

    return (
        <div className="project-taxonomy" data-testid="project-taxonomy">
            {/* Subjects section */}
            <section
                className="project-taxonomy-section"
                data-testid="project-taxonomy-subjects"
            >
                <header className="project-taxonomy-header">
                    <h3>{t("taxonomy.subjects", "Subjects")}</h3>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        data-testid="project-taxonomy-add-subject"
                        onClick={() => setShowSubjectPicker((v) => !v)}
                        disabled={submitting}
                    >
                        {showSubjectPicker
                            ? t("common.close", "Close")
                            : t("taxonomy.assign_subject", "+ Assign")}
                    </button>
                </header>
                {assignedSubjects.length === 0 ? (
                    <p
                        className="project-taxonomy-empty"
                        data-testid="project-taxonomy-subjects-empty"
                    >
                        {t("taxonomy.no_subjects_assigned", "No subjects assigned.")}
                    </p>
                ) : (
                    <ul
                        className="taxonomy-chip-list"
                        data-testid="project-taxonomy-subject-chips"
                    >
                        {assignedSubjects.map((subject) => (
                            <li key={subject.id} className="taxonomy-chip">
                                {subject.icon && (
                                    <span aria-hidden="true">{subject.icon}</span>
                                )}{" "}
                                {subject.name}
                                <button
                                    type="button"
                                    className="taxonomy-chip-remove"
                                    data-testid={`project-taxonomy-unassign-subject-${subject.id}`}
                                    onClick={() =>
                                        void handleUnassignSubject(subject.id)
                                    }
                                    aria-label={`Remove ${subject.name}`}
                                    title={
                                        tooltipsOn
                                            ? `Remove ${subject.name}`
                                            : undefined
                                    }
                                    disabled={submitting}
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {showSubjectPicker && (
                    <div
                        className="project-taxonomy-picker"
                        data-testid="project-taxonomy-subject-picker"
                    >
                        <SubjectBrowser
                            onSelect={(id) => void handleAssignSubject(id)}
                            readOnly={false}
                        />
                    </div>
                )}
            </section>

            {/* Tags section */}
            <section
                className="project-taxonomy-section"
                data-testid="project-taxonomy-tags"
            >
                <header className="project-taxonomy-header">
                    <h3>{t("taxonomy.tags", "Tags")}</h3>
                </header>
                {allTags.length === 0 ? (
                    <p
                        className="project-taxonomy-empty"
                        data-testid="project-taxonomy-tags-empty"
                    >
                        {t("taxonomy.no_user_tags", "No tags yet — create one below.")}
                    </p>
                ) : (
                    <ul
                        className="taxonomy-chip-list"
                        data-testid="project-taxonomy-tag-chips"
                    >
                        {allTags.map((tag) => {
                            const isAssigned = assignedTags.some(
                                (t) => t.id === tag.id,
                            );
                            return (
                                <li key={tag.id} className="taxonomy-chip">
                                    <button
                                        type="button"
                                        className={`tag-badge${isAssigned ? " tag-badge-selected" : ""}`}
                                        data-testid={`project-taxonomy-tag-toggle-${tag.id}`}
                                        style={{
                                            backgroundColor: tag.color ?? DEFAULT_COLOR,
                                            opacity: isAssigned ? 1 : 0.45,
                                        }}
                                        onClick={() => void handleToggleTag(tag)}
                                        disabled={submitting}
                                    >
                                        {tag.name}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <form
                    className="project-taxonomy-tag-create"
                    data-testid="project-taxonomy-tag-create-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleCreateAndAssignTag();
                    }}
                >
                    <input
                        type="text"
                        data-testid="project-taxonomy-tag-create-input"
                        placeholder={t("taxonomy.new_tag", "New tag…")}
                        aria-label={t("taxonomy.new_tag", "New tag…")}
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        disabled={submitting}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        data-testid="project-taxonomy-tag-create-submit"
                        disabled={submitting || newTagName.trim().length === 0}
                    >
                        {t("taxonomy.add_and_assign", "Add + assign")}
                    </button>
                </form>
            </section>
        </div>
    );
}
