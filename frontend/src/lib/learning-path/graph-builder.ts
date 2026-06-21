/**
 * Learning-path graph builder (Phase 66E / EXP-022).
 *
 * PURE function: (real user data) -> ({nodes, edges}) for React Flow.
 * No React, no I/O — the caller loads content sets, lesson progress,
 * per-direction mastery (ElementError) and the adaptive
 * recommendation, then this turns them into one SetGroupNode per set
 * + one LessonNode per lesson + sequential/adaptive edges. Testable
 * without a DOM.
 *
 * The recommendation is computed by the EXISTING adaptive analyzer at
 * the call site and passed in as ``recommendedKey`` — no new
 * recommendation logic lives here.
 */

import type {Edge, Node} from "@xyflow/react";

import type {LessonNodeData} from "../../components/learning-path/LessonNodeView";
import type {SetGroupNodeData} from "../../components/learning-path/SetGroupNodeView";
import {computeStars} from "../lesson/lesson-summary";
import type {ElementError, LessonProgress} from "../../storage/types";
import {makeEdge} from "./layout";

export interface GraphLessonInput {
    filename: string;
    /** 1-based position within the set (display + ordering). */
    number: number;
    title: string;
    exerciseCount: number;
}

export interface GraphSetInput {
    setId: string;
    source: string;
    title: string;
    sourceLanguage: string;
    targetLanguage: string;
    /** Ordered lessons. */
    lessons: GraphLessonInput[];
}

export interface GraphBuildInput {
    sets: GraphSetInput[];
    /** keyed by ``lessonKey(setId, filename)``. */
    progress: Record<string, LessonProgress>;
    /** ElementError rows per lesson, keyed by ``lessonKey``. */
    errors: Record<string, ElementError[]>;
    /** ``lessonKey`` of the adaptive next pick, or null. */
    recommendedKey?: string | null;
}

export interface BuiltGraph {
    nodes: Node[];
    edges: Edge[];
}

export function lessonKey(setId: string, filename: string): string {
    return `${setId}::${filename}`;
}

interface LessonMastery {
    receptive: boolean;
    productive: boolean;
}

/** A direction is "mastered" for a lesson when it has at least one
 *  tracked element in that direction and every one is mastered.
 *  No tracked elements in a direction -> not (yet) mastered. */
export function masteryForLesson(rows: ElementError[]): LessonMastery {
    const rec = rows.filter(
        (r) => (r.direction ?? "target_to_source") === "target_to_source",
    );
    const pro = rows.filter((r) => r.direction === "source_to_target");
    return {
        receptive: rec.length > 0 && rec.every((r) => r.mastered),
        productive: pro.length > 0 && pro.every((r) => r.mastered),
    };
}

function statusFor(
    progress: LessonProgress | undefined,
    mastery: LessonMastery,
): LessonNodeData["status"] {
    if (!progress) return "not_started";
    if (progress.status === "paused") return "paused";
    if (progress.status === "in_progress") return "in_progress";
    if (progress.status === "abandoned") return "in_progress";
    // completed:
    if (mastery.receptive && mastery.productive) return "mastered";
    return "completed";
}

export function buildLearningPathGraph(input: GraphBuildInput): BuiltGraph {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    for (const set of input.sets) {
        const setSlug = set.source.replace(/\//g, "--");
        let completed = 0;
        let receptiveMastered = 0;
        let productiveMastered = 0;

        // Lesson nodes.
        set.lessons.forEach((lesson, idx) => {
            const key = lessonKey(set.setId, lesson.filename);
            const progress = input.progress[key];
            const mastery = masteryForLesson(input.errors[key] ?? []);
            const status = statusFor(progress, mastery);
            if (status === "completed" || status === "mastered") completed += 1;
            if (mastery.receptive) receptiveMastered += 1;
            if (mastery.productive) productiveMastered += 1;

            const stars = progress
                ? computeStars(
                      progress.score_correct ?? 0,
                      progress.score_total ?? 0,
                  )
                : 0;

            const data: LessonNodeData = {
                lessonNumber: lesson.number,
                title: lesson.title,
                stars,
                status,
                receptiveMastered: mastery.receptive,
                productiveMastered: mastery.productive,
                xp: 0, // per-lesson XP is not tracked; badge stays off
                exerciseCount: lesson.exerciseCount,
                recommended: input.recommendedKey === key,
                locked: false,
                setSlug,
                setId: set.setId,
                lessonFilename: lesson.filename,
            };
            nodes.push({
                id: key,
                type: "lesson",
                position: {x: 0, y: 0},
                data,
            });

            // Sequential edge from the previous lesson.
            if (idx > 0) {
                const prev = set.lessons[idx - 1];
                const prevKey = lessonKey(set.setId, prev.filename);
                const prevDone =
                    input.progress[prevKey]?.status === "completed";
                const kind =
                    input.recommendedKey === key
                        ? "adaptive"
                        : prevDone
                          ? "completed"
                          : "upcoming";
                edges.push(makeEdge(`e-${prevKey}->${key}`, prevKey, key, kind));
            }
        });

        // Group node (header above the set's lessons) + a connector
        // edge to the first lesson so dagre stacks them.
        const groupData: SetGroupNodeData = {
            setId: set.setId,
            title: set.title,
            sourceLanguage: set.sourceLanguage,
            targetLanguage: set.targetLanguage,
            completed,
            total: set.lessons.length,
            receptiveMastered,
            productiveMastered,
            collapsed: false,
        };
        const groupId = `group-${set.setId}`;
        nodes.push({
            id: groupId,
            type: "setGroup",
            position: {x: 0, y: 0},
            data: groupData,
        });
        if (set.lessons.length > 0) {
            const firstKey = lessonKey(set.setId, set.lessons[0].filename);
            edges.push(
                makeEdge(`e-${groupId}->${firstKey}`, groupId, firstKey, "upcoming"),
            );
        }
    }

    return {nodes, edges};
}
