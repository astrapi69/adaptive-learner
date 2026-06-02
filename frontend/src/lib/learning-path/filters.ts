/**
 * Learning-path filtering, search highlight + stats (Phase 66F).
 * Pure helpers over LessonNodeData — testable without React/React Flow.
 */

import type {LessonNodeData} from "../../components/learning-path/LessonNodeView";

export type StatusFilter = "all" | "not_started" | "in_progress" | "mastered";
export type DirectionFilter = "all" | "receptive" | "productive";

export interface GraphFilters {
    status: StatusFilter;
    direction: DirectionFilter;
    query: string;
}

export const DEFAULT_FILTERS: GraphFilters = {
    status: "all",
    direction: "all",
    query: "",
};

export interface NodeDisplay {
    /** Hidden by the status/direction filter. */
    hidden: boolean;
    /** Search active + this node doesn't match (fade to ~30%). */
    faded: boolean;
    /** Search active + this node matches (glow). */
    highlighted: boolean;
}

function passesStatus(status: string, f: StatusFilter): boolean {
    switch (f) {
        case "all":
            return true;
        case "in_progress":
            return status === "in_progress" || status === "paused";
        case "mastered":
            return status === "mastered";
        case "not_started":
            return status === "not_started";
        default:
            return true;
    }
}

function passesDirection(d: LessonNodeData, f: DirectionFilter): boolean {
    if (f === "all") return true;
    if (f === "receptive") return d.receptiveMastered;
    return d.productiveMastered;
}

export function matchesQuery(d: LessonNodeData, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return (
        d.title.toLowerCase().includes(q) || String(d.lessonNumber) === q
    );
}

/** Display state for a lesson node under the given filters. */
export function classifyNode(
    d: LessonNodeData,
    filters: GraphFilters,
): NodeDisplay {
    const hidden =
        !passesStatus(d.status, filters.status) ||
        !passesDirection(d, filters.direction);
    if (!filters.query.trim()) {
        return {hidden, faded: false, highlighted: false};
    }
    const m = matchesQuery(d, filters.query);
    return {hidden, faded: !m, highlighted: m};
}

export interface GraphStats {
    totalLessons: number;
    completed: number;
    receptiveMastered: number;
    productiveMastered: number;
}

export function graphStats(lessons: LessonNodeData[]): GraphStats {
    let completed = 0;
    let receptiveMastered = 0;
    let productiveMastered = 0;
    for (const d of lessons) {
        if (d.status === "completed" || d.status === "mastered") completed += 1;
        if (d.receptiveMastered) receptiveMastered += 1;
        if (d.productiveMastered) productiveMastered += 1;
    }
    return {
        totalLessons: lessons.length,
        completed,
        receptiveMastered,
        productiveMastered,
    };
}

/** First lesson whose title matches the query (for Enter-to-jump). */
export function firstMatch(
    lessons: LessonNodeData[],
    query: string,
): LessonNodeData | null {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return lessons.find((d) => d.title.toLowerCase().includes(q)) ?? null;
}
