/**
 * DashboardFilterBar (Phase 22E).
 *
 * Cross-project filter for the Dashboard: pick a Subject + zero
 * or more Tags. The matching set of projects is displayed below
 * the filter UI; clicking a project switches the active projectId
 * (the per-project widgets re-load against it).
 *
 * Filter state lives in URL query params so it's shareable +
 * bookmarkable:
 *   /dashboard?subject=<id>&tag=<id>&tag=<id>
 * The hook re-reads on mount + when params change.
 *
 * The component is fully self-contained: it owns the lookups for
 * all projects, all subjects, all tags, and the per-project
 * subject + tag assignments.
 */

import {useEffect, useMemo, useState} from "react";
import {useSearchParams} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {useI18n} from "../hooks/useI18n";
import {filterStandardProjects} from "../lib/learning-project";
import {readLearnerState, setProjectId} from "../lib/learnerState";
import {getStorage} from "../storage";
import type {
    LearningProject,
    Subject,
    Tag,
} from "../types/domain";
import {notify} from "../utils/notify";

interface DashboardFilterBarProps {
    userId: string;
    /** Fired whenever the matched-projects set changes, so the
     *  parent can decide whether to re-fetch its widgets. The
     *  current implementation does NOT auto-re-fetch (the active
     *  project is the unit the widgets render against). */
    onMatchedProjectsChange?: (projects: LearningProject[]) => void;
    /** Fired when the user picks a project from the matched
     *  list — the page reloads its widgets against the new id. */
    onSelectProject?: (projectId: string) => void;
}

interface FilterIndex {
    /** project_id -> Subject ids assigned to that project. */
    subjectsByProject: Map<string, Set<string>>;
    /** project_id -> Tag ids assigned to that project. */
    tagsByProject: Map<string, Set<string>>;
}

async function buildFilterIndex(
    projects: LearningProject[],
): Promise<FilterIndex> {
    const storage = getStorage();
    const subjectsByProject = new Map<string, Set<string>>();
    const tagsByProject = new Map<string, Set<string>>();
    // Parallelize per-project so the bar populates quickly even
    // for users with many projects. Each call is small.
    await Promise.all(
        projects.map(async (project) => {
            const [subs, tags] = await Promise.all([
                storage.projectTaxonomy.listSubjects(project.id),
                storage.projectTaxonomy.listTags(project.id),
            ]);
            subjectsByProject.set(project.id, new Set(subs.map((s) => s.id)));
            tagsByProject.set(project.id, new Set(tags.map((t) => t.id)));
        }),
    );
    return {subjectsByProject, tagsByProject};
}

/**
 * Apply the filter against the project list. A project matches
 * iff it carries EVERY selected subject (currently 1 max) AND
 * EVERY selected tag (AND-semantics across criteria, AND across
 * selected tags). Returns the matching subset in input order.
 */
export function applyFilter(
    projects: LearningProject[],
    index: FilterIndex,
    selectedSubjectId: string | null,
    selectedTagIds: ReadonlySet<string>,
): LearningProject[] {
    return projects.filter((project) => {
        const subs = index.subjectsByProject.get(project.id) ?? new Set();
        const tags = index.tagsByProject.get(project.id) ?? new Set();
        if (selectedSubjectId !== null && !subs.has(selectedSubjectId)) {
            return false;
        }
        for (const tagId of selectedTagIds) {
            if (!tags.has(tagId)) return false;
        }
        return true;
    });
}

const DEFAULT_COLOR = "#6366f1";

export default function DashboardFilterBar({
    userId,
    onMatchedProjectsChange,
    onSelectProject,
}: DashboardFilterBarProps) {
    const {t} = useI18n();
    const [searchParams, setSearchParams] = useSearchParams();
    const [projects, setProjects] = useState<LearningProject[]>([]);
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [index, setIndex] = useState<FilterIndex | null>(null);
    const [loading, setLoading] = useState(true);

    const selectedSubjectId = searchParams.get("subject");
    const selectedTagIds = useMemo(
        () => new Set(searchParams.getAll("tag")),
        [searchParams],
    );

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const storage = getStorage();
                const [rawProj, subs, tags] = await Promise.all([
                    storage.users.projects.list(userId),
                    storage.subjects.list(),
                    storage.tags.list(userId),
                ]);
                if (cancelled) return;
                // v1.31.0 / Phase 46F.3: hide the auto-managed
                // "Content Lessons" pseudo-project from the
                // dashboard filter — it owns content-lesson
                // LearningSession rows but isn't a goal a user
                // can pick, edit, or archive.
                const proj = filterStandardProjects(rawProj);
                setProjects(proj);
                setAllSubjects(subs);
                setAllTags(tags);
                const built = await buildFilterIndex(proj);
                if (cancelled) return;
                setIndex(built);
            } catch (err) {
                if (cancelled) return;
                notify.error(
                    err instanceof Error
                        ? err.message
                        : t("taxonomy.filter_load_failed", "Failed to load filter data."),
                );
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [userId, t]);

    const matched = useMemo(() => {
        if (index === null) return [];
        return applyFilter(projects, index, selectedSubjectId, selectedTagIds);
    }, [projects, index, selectedSubjectId, selectedTagIds]);

    useEffect(() => {
        onMatchedProjectsChange?.(matched);
    }, [matched, onMatchedProjectsChange]);

    function setSubject(subjectId: string | null) {
        const next = new URLSearchParams(searchParams);
        if (subjectId === null) {
            next.delete("subject");
        } else {
            next.set("subject", subjectId);
        }
        setSearchParams(next);
    }

    function toggleTag(tagId: string) {
        const next = new URLSearchParams(searchParams);
        const current = next.getAll("tag");
        next.delete("tag");
        if (current.includes(tagId)) {
            for (const id of current) {
                if (id !== tagId) next.append("tag", id);
            }
        } else {
            for (const id of current) next.append("tag", id);
            next.append("tag", tagId);
        }
        setSearchParams(next);
    }

    function clearFilters() {
        const next = new URLSearchParams(searchParams);
        next.delete("subject");
        next.delete("tag");
        setSearchParams(next);
    }

    const hasFilter = selectedSubjectId !== null || selectedTagIds.size > 0;

    if (loading) {
        return (
            <div
                className="dashboard-filter-bar"
                data-testid="dashboard-filter-loading"
            >
                {t("taxonomy.loading", "Loading filters…")}
            </div>
        );
    }

    return (
        <section
            className="dashboard-filter-bar"
            data-testid="dashboard-filter-bar"
        >
            <header className="dashboard-filter-header">
                <h2>{t("taxonomy.filter_title", "Filter projects")}</h2>
                {hasFilter && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        data-testid="dashboard-filter-clear"
                        onClick={clearFilters}
                    >
                        {t("taxonomy.clear_filters", "Clear filters")}
                    </Button>
                )}
            </header>

            <div className="dashboard-filter-controls">
                <label className="dashboard-filter-row">
                    <span>{t("taxonomy.subject", "Subject")}</span>
                    <select
                        data-testid="dashboard-filter-subject-select"
                        value={selectedSubjectId ?? ""}
                        onChange={(e) =>
                            setSubject(e.target.value === "" ? null : e.target.value)
                        }
                    >
                        <option value="">
                            {t("taxonomy.all_subjects", "All subjects")}
                        </option>
                        {allSubjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                                {subject.icon ? `${subject.icon} ` : ""}
                                {subject.name}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="dashboard-filter-tags">
                    <span>{t("taxonomy.tags", "Tags")}</span>
                    {allTags.length === 0 ? (
                        <span className="muted">
                            {t("taxonomy.no_user_tags_short", "No tags yet.")}
                        </span>
                    ) : (
                        <ul
                            className="taxonomy-chip-list"
                            data-testid="dashboard-filter-tag-list"
                        >
                            {allTags.map((tag) => {
                                const isOn = selectedTagIds.has(tag.id);
                                return (
                                    <li key={tag.id}>
                                        <button
                                            type="button"
                                            className={`tag-badge${isOn ? " tag-badge-selected" : ""}`}
                                            data-testid={`dashboard-filter-tag-${tag.id}`}
                                            style={{
                                                backgroundColor:
                                                    tag.color ?? DEFAULT_COLOR,
                                                opacity: isOn ? 1 : 0.45,
                                            }}
                                            onClick={() => toggleTag(tag.id)}
                                        >
                                            {tag.name}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            <div
                className="dashboard-filter-results"
                data-testid="dashboard-filter-results"
            >
                <h3>
                    {hasFilter
                        ? t("taxonomy.filtered_projects", `Matching projects (${matched.length})`)
                        : t("taxonomy.all_projects", `All projects (${projects.length})`)}
                </h3>
                {matched.length === 0 ? (
                    <p
                        className="muted"
                        data-testid="dashboard-filter-empty"
                    >
                        {hasFilter
                            ? t("taxonomy.no_matching_projects", "No projects match.")
                            : t("taxonomy.no_projects", "No projects yet.")}
                    </p>
                ) : (
                    <ul
                        className="dashboard-project-list"
                        data-testid="dashboard-filter-project-list"
                    >
                        {matched.map((project) => {
                            const activeId = readLearnerState().projectId;
                            const isActive = project.id === activeId;
                            return (
                                <li
                                    key={project.id}
                                    className={`dashboard-project-item${isActive ? " dashboard-project-item-active" : ""}`}
                                    data-testid={`dashboard-project-item-${project.id}`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProjectId(project.id);
                                            onSelectProject?.(project.id);
                                        }}
                                    >
                                        {project.topic}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}
