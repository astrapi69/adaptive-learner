/**
 * usePersonalPath — loads the data behind the redesigned (personal)
 * Learning Path and returns a built {@link PersonalPathData}.
 *
 * Mirrors useLearningPathData's loading shape (downloaded content
 * sets → their lessons → LessonProgress → ElementError mastery) but
 * delegates to the pure ``buildPersonalPath`` instead of the graph
 * builder, and also threads through the available-but-not-downloaded
 * sets for the "Nicht heruntergeladen" section.
 *
 * Storage-mode-agnostic (routes through getStorage). Failure-tolerant:
 * a thrown read sets ``state = "error"`` rather than crashing the page.
 */

import {useEffect, useState} from "react";

import {
    buildPersonalPath,
    type PersonalPathData,
    type PersonalSetInput,
} from "../../lib/learning-path/personal-path";
import {lessonKey} from "../../lib/learning-path/graph-builder";
import {getStorage} from "../../storage";
import type {
    ContentSetEntry,
    ElementError,
    LessonProgress,
} from "../../storage/types";

export type PersonalPathState = "loading" | "empty" | "ready" | "error";

export interface UsePersonalPathResult {
    state: PersonalPathState;
    data: PersonalPathData | null;
    /** Re-run the load (e.g. after a download from the bottom section). */
    reload: () => void;
}

export function usePersonalPath(userId: string): UsePersonalPathResult {
    const [state, setState] = useState<PersonalPathState>("loading");
    const [data, setData] = useState<PersonalPathData | null>(null);
    const [nonce, setNonce] = useState(0);

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
                const notDownloaded: ContentSetEntry[] = setsList.sets.filter(
                    (s) => !s.cached_version,
                );

                if (downloaded.length === 0) {
                    setData(
                        buildPersonalPath({
                            sets: [],
                            progress: {},
                            errors: {},
                            notDownloaded,
                        }),
                    );
                    setState("empty");
                    return;
                }

                const sets: PersonalSetInput[] = [];
                for (const entry of downloaded) {
                    const listing = await storage.contentLoader.listLessons(
                        entry.source,
                        entry.id,
                    );
                    if (cancelled) return;
                    const lessons = await Promise.all(
                        listing.lessons.map(async (filename, i) => {
                            let title = filename.replace(/\.[^.]+$/, "");
                            try {
                                const lesson =
                                    await storage.contentLoader.getLesson(
                                        entry.source,
                                        entry.id,
                                        filename,
                                    );
                                title = lesson.title || title;
                            } catch {
                                /* keep filename fallback */
                            }
                            return {filename, number: i + 1, title};
                        }),
                    );
                    sets.push({entry, lessons});
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

                setData(
                    buildPersonalPath({
                        sets,
                        progress,
                        errors,
                        notDownloaded,
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
    }, [userId, nonce]);

    return {state, data, reload: () => setNonce((n) => n + 1)};
}
