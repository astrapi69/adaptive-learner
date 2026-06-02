/**
 * useLearningPathData (Phase 66E) — loads the real data the learning
 * path graph is built from and returns a built {nodes, edges} graph.
 *
 * Loads downloaded content sets → their lessons (title + exercise
 * count) → LessonProgress → ElementError mastery, computes the
 * recommended next lesson via the EXISTING adaptive analyzer (focus
 * set → first not-completed lesson there; else first not-started
 * overall), then delegates to the pure ``buildLearningPathGraph``.
 *
 * Storage-mode-agnostic (routes through getStorage). Failure-tolerant:
 * a thrown read sets ``state = "error"`` rather than crashing the page.
 */

import {useEffect, useState} from "react";

import {analyzeErrors} from "../lib/adaptive/error-analyzer";
import {
    buildLearningPathGraph,
    lessonKey,
    type BuiltGraph,
    type GraphSetInput,
} from "../lib/learning-path/graph-builder";
import {getStorage} from "../storage";
import type {ElementError, LessonProgress} from "../storage/types";

export type LearningPathState = "loading" | "empty" | "ready" | "error";

function pickRecommended(
    sets: GraphSetInput[],
    progress: Record<string, LessonProgress>,
    errorRows: ElementError[],
): string | null {
    // Reuse the existing analyzer to choose the focus set.
    const analysis = analyzeErrors(errorRows);
    const focusSetId = analysis.suggested_focus[0]?.set_id;
    const firstUndone = (s: GraphSetInput) =>
        s.lessons.find(
            (l) =>
                progress[lessonKey(s.setId, l.filename)]?.status !== "completed",
        );
    if (focusSetId) {
        const set = sets.find((s) => s.setId === focusSetId);
        const lesson = set && firstUndone(set);
        if (set && lesson) return lessonKey(set.setId, lesson.filename);
    }
    // Fallback: the first never-started lesson across all sets.
    for (const set of sets) {
        const lesson = set.lessons.find(
            (l) => !progress[lessonKey(set.setId, l.filename)],
        );
        if (lesson) return lessonKey(set.setId, lesson.filename);
    }
    return null;
}

export function useLearningPathData(userId: string): {
    state: LearningPathState;
    built: BuiltGraph | null;
} {
    const [state, setState] = useState<LearningPathState>("loading");
    const [built, setBuilt] = useState<BuiltGraph | null>(null);

    useEffect(() => {
        let cancelled = false;
        setState("loading");
        void (async () => {
            try {
                const storage = getStorage();
                const setsList = await storage.contentLoader.listSets();
                if (cancelled) return;
                const downloaded = setsList.sets.filter(
                    (s) => s.cached_version,
                );
                if (downloaded.length === 0) {
                    setState("empty");
                    return;
                }

                const graphSets: GraphSetInput[] = [];
                for (const entry of downloaded) {
                    const listing = await storage.contentLoader.listLessons(
                        entry.source,
                        entry.id,
                    );
                    if (cancelled) return;
                    const lessons = await Promise.all(
                        listing.lessons.map(async (filename, i) => {
                            let title = filename.replace(/\.[^.]+$/, "");
                            let exerciseCount = 0;
                            try {
                                const lesson =
                                    await storage.contentLoader.getLesson(
                                        entry.source,
                                        entry.id,
                                        filename,
                                    );
                                title = lesson.title || title;
                                exerciseCount = lesson.steps.filter(
                                    (s) => s.type === "exercise",
                                ).length;
                            } catch {
                                /* keep filename fallback */
                            }
                            return {filename, number: i + 1, title, exerciseCount};
                        }),
                    );
                    graphSets.push({
                        setId: entry.id,
                        source: entry.source,
                        title: entry.title,
                        sourceLanguage: entry.source_language,
                        targetLanguage: entry.target_language,
                        lessons,
                    });
                }
                if (cancelled) return;

                const progressList = userId
                    ? await storage.lessonProgress.list(userId)
                    : [];
                const progress: Record<string, LessonProgress> = {};
                for (const p of progressList) {
                    progress[lessonKey(p.set_id, p.lesson_filename)] = p;
                }

                const errorRows = userId
                    ? await storage.elementErrors.list(userId, {
                          includeMastered: true,
                      })
                    : [];
                const errors: Record<string, ElementError[]> = {};
                for (const e of errorRows) {
                    const k = lessonKey(e.set_id, e.lesson_id);
                    (errors[k] ??= []).push(e);
                }
                if (cancelled) return;

                const recommendedKey = pickRecommended(
                    graphSets,
                    progress,
                    errorRows,
                );
                setBuilt(
                    buildLearningPathGraph({
                        sets: graphSets,
                        progress,
                        errors,
                        recommendedKey,
                    }),
                );
                setState("ready");
            } catch {
                if (!cancelled) setState("error");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    return {state, built};
}
