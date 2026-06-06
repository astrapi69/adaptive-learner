/**
 * Subject-filter ordering + grouping for the Dashboard filter (#111,
 * follow-up to #72).
 *
 * The filter already shows only the subjects a user actually uses; these
 * pure helpers decide how to present them:
 *   - rank by usage (how many of the user's projects carry the subject),
 *     most-used first, so the relevant ones surface at the top;
 *   - group by category (the parent subject) once the list is long
 *     enough that a flat <select> stops being scannable.
 *
 * Kept free of React and i18n so they are unit-testable in isolation;
 * category labels are translated at render time by the caller.
 */

import type {Subject} from "../../types/domain";

/** Above this many subjects, the flat list is grouped by category. */
export const SUBJECT_GROUP_THRESHOLD = 5;

/** One category group: the parent subject (or null when a used subject
 *  is itself top-level / its parent is unknown) plus its members in
 *  ranked order. */
export interface SubjectGroup {
    categoryId: string | null;
    /** The category's raw (untranslated) name, or null for "ungrouped". */
    categoryName: string | null;
    subjects: Subject[];
}

/**
 * Count how many of the user's projects carry each subject, from the
 * ``project_id -> subject ids`` index the filter already builds.
 */
export function countProjectsPerSubject(
    subjectsByProject: Map<string, Set<string>>,
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const ids of subjectsByProject.values()) {
        for (const id of ids) {
            counts.set(id, (counts.get(id) ?? 0) + 1);
        }
    }
    return counts;
}

/**
 * Sort subjects by usage (descending), breaking ties by name so the
 * order is stable and deterministic.
 */
export function rankSubjects(
    subjects: Subject[],
    usage: Map<string, number>,
): Subject[] {
    return [...subjects].sort((a, b) => {
        const byUsage = (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0);
        if (byUsage !== 0) return byUsage;
        return a.name.localeCompare(b.name);
    });
}

/**
 * Group ranked subjects under their category (the parent subject).
 * A subject whose parent is unknown — or which is itself top-level —
 * forms its own single-item group. Groups are ordered by total usage
 * (most-used category first), then by category name; members keep their
 * incoming ranked order.
 */
export function groupSubjectsByCategory(
    ranked: Subject[],
    allSubjects: Subject[],
    usage: Map<string, number>,
): SubjectGroup[] {
    const byId = new Map(allSubjects.map((s) => [s.id, s]));
    const groups = new Map<string, SubjectGroup>();
    const order: string[] = [];

    for (const subject of ranked) {
        const parent =
            subject.parent_id != null ? byId.get(subject.parent_id) : undefined;
        const category = parent ?? subject;
        const key = category.id;
        let group = groups.get(key);
        if (!group) {
            group = {
                categoryId: category.id,
                categoryName: category.name,
                subjects: [],
            };
            groups.set(key, group);
            order.push(key);
        }
        group.subjects.push(subject);
    }

    const totalUsage = (group: SubjectGroup): number =>
        group.subjects.reduce((sum, s) => sum + (usage.get(s.id) ?? 0), 0);

    return order
        .map((key) => groups.get(key) as SubjectGroup)
        .sort((a, b) => {
            const byUsage = totalUsage(b) - totalUsage(a);
            if (byUsage !== 0) return byUsage;
            return (a.categoryName ?? "").localeCompare(b.categoryName ?? "");
        });
}
