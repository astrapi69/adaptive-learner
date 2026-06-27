import {describe, it, expect} from "vitest";

import {
    buildPersonalPath,
    type BuildPersonalPathInput,
    type PersonalSetInput,
} from "./personal-path";
import {lessonKey} from "./graph-builder";
import type {
    ContentSetEntry,
    ElementError,
    LessonProgress,
} from "../../storage/types";

function entry(overrides: Partial<ContentSetEntry> = {}): ContentSetEntry {
    return {
        source: "astrapi69/adaptive-learner-content",
        branch: "main",
        id: "psych",
        title: "Psychologie",
        title_native: null,
        language: "de",
        target_language: "de",
        source_language: "de",
        level: "a1",
        domain: "psychology",
        version: "1.0.0",
        lesson_count: 3,
        description: null,
        tags: [],
        cover_image: null,
        cached_version: "1.0.0",
        update_available: false,
        ...overrides,
    };
}

function progress(
    setId: string,
    filename: string,
    overrides: Partial<LessonProgress> = {},
): LessonProgress {
    return {
        id: `${setId}-${filename}`,
        user_id: "u1",
        source: "astrapi69/adaptive-learner-content",
        set_id: setId,
        lesson_filename: filename,
        status: "completed",
        step_results: {},
        score_correct: 9,
        score_total: 10,
        time_spent_seconds: 0,
        started_at: "2026-06-01T10:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
        completed_at: "2026-06-01T10:00:00Z",
        paused_at: null,
        abandoned_at: null,
        ...overrides,
    };
}

function errorRow(
    setId: string,
    filename: string,
    overrides: Partial<ElementError> = {},
): ElementError {
    return {
        id: `${setId}-${filename}-e`,
        user_id: "u1",
        set_id: setId,
        lesson_id: filename,
        exercise_id: "ex1",
        element_key: "k1",
        direction: "target_to_source",
        element_type: "word",
        user_answer: "x",
        correct_answer: "y",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-06-01T10:00:00Z",
        last_attempt_at: "2026-06-01T10:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-06-01T10:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
        ...overrides,
    };
}

function setInput(
    id: string,
    title: string,
    filenames: string[],
    overrides: Partial<ContentSetEntry> = {},
): PersonalSetInput {
    return {
        entry: entry({id, title, lesson_count: filenames.length, ...overrides}),
        lessons: filenames.map((filename, i) => ({
            filename,
            number: i + 1,
            title: filename.replace(/\.json$/, ""),
        })),
    };
}

function build(partial: Partial<BuildPersonalPathInput>): ReturnType<
    typeof buildPersonalPath
> {
    return buildPersonalPath({
        sets: [],
        progress: {},
        errors: {},
        notDownloaded: [],
        ...partial,
    });
}

describe("buildPersonalPath — set grouping + percentage", () => {
    it("computes completed count and percentage from progress", () => {
        const sets = [setInput("psych", "Psychologie", ["01.json", "02.json", "03.json", "04.json"])];
        const result = build({
            sets,
            progress: {
                [lessonKey("psych", "01.json")]: progress("psych", "01.json"),
                [lessonKey("psych", "02.json")]: progress("psych", "02.json"),
            },
        });
        const set = result.activeSets[0];
        expect(set.totalCount).toBe(4);
        expect(set.completedCount).toBe(2);
        expect(set.percentComplete).toBe(50);
    });

    it("rounds the percentage", () => {
        const sets = [setInput("s", "S", ["01.json", "02.json", "03.json"])];
        const result = build({
            sets,
            progress: {
                [lessonKey("s", "01.json")]: progress("s", "01.json"),
            },
        });
        expect(result.activeSets[0].percentComplete).toBe(33);
    });

    it("an untouched set is 0% with no last activity", () => {
        const sets = [setInput("py", "Python", ["01.json", "02.json"])];
        const result = build({sets});
        expect(result.activeSets[0].percentComplete).toBe(0);
        expect(result.activeSets[0].lastActivity).toBeNull();
    });
});

describe("buildPersonalPath — sorting by last activity", () => {
    it("sorts sets by most recent activity first", () => {
        const sets = [
            setInput("old", "Old", ["01.json"]),
            setInput("new", "New", ["01.json"]),
        ];
        const result = build({
            sets,
            progress: {
                [lessonKey("old", "01.json")]: progress("old", "01.json", {
                    updated_at: "2026-06-01T10:00:00Z",
                }),
                [lessonKey("new", "01.json")]: progress("new", "01.json", {
                    updated_at: "2026-06-03T10:00:00Z",
                }),
            },
        });
        expect(result.activeSets.map((s) => s.setId)).toEqual(["new", "old"]);
    });

    it("sinks untouched downloaded sets below active ones", () => {
        const sets = [
            setInput("py", "Python", ["01.json"]),
            setInput("psych", "Psychologie", ["01.json"]),
        ];
        const result = build({
            sets,
            progress: {
                [lessonKey("psych", "01.json")]: progress("psych", "01.json"),
            },
        });
        expect(result.activeSets.map((s) => s.setId)).toEqual(["psych", "py"]);
    });

    // #1211 — a freshly downloaded (untouched) set must appear above older
    // untouched downloads, ordered by download date descending — not by title.
    it("orders untouched downloaded sets by most-recent download first", () => {
        const sets = [
            setInput("alpha", "Alpha", ["01.json"], {
                downloaded_at: "2026-06-01T00:00:00Z",
            }),
            setInput("zulu", "Zulu", ["01.json"], {
                downloaded_at: "2026-06-20T00:00:00Z",
            }),
        ];
        const result = build({sets});
        // Both untouched: Zulu was downloaded later, so it must come first
        // even though its title sorts after Alpha.
        expect(result.activeSets.map((s) => s.setId)).toEqual(["zulu", "alpha"]);
    });
});

describe("buildPersonalPath — action resolution", () => {
    it("resumes an in-progress lesson", () => {
        const sets = [setInput("s", "S", ["01.json", "02.json", "03.json"])];
        const result = build({
            sets,
            progress: {
                [lessonKey("s", "01.json")]: progress("s", "01.json"),
                [lessonKey("s", "02.json")]: progress("s", "02.json", {
                    status: "in_progress",
                    completed_at: null,
                }),
            },
        });
        const set = result.activeSets[0];
        expect(set.mode).toBe("resume");
        expect(set.currentLesson?.filename).toBe("02.json");
        expect(set.currentLesson?.isCurrent).toBe(true);
    });

    it("marks 'start' for a fully untouched set", () => {
        const sets = [setInput("py", "Python", ["01.json", "02.json"])];
        const result = build({sets});
        const set = result.activeSets[0];
        expect(set.mode).toBe("start");
        expect(set.currentLesson?.filename).toBe("01.json");
    });

    it("marks 'next' pointing at the first not-started lesson", () => {
        const sets = [setInput("s", "S", ["01.json", "02.json", "03.json"])];
        const result = build({
            sets,
            progress: {
                [lessonKey("s", "01.json")]: progress("s", "01.json"),
            },
        });
        const set = result.activeSets[0];
        expect(set.mode).toBe("next");
        expect(set.currentLesson?.filename).toBe("02.json");
    });

    it("marks 'set_complete' when every lesson is done", () => {
        const sets = [setInput("fr", "Französisch A1", ["01.json", "02.json"])];
        const result = build({
            sets,
            progress: {
                [lessonKey("fr", "01.json")]: progress("fr", "01.json"),
                [lessonKey("fr", "02.json")]: progress("fr", "02.json"),
            },
        });
        const set = result.activeSets[0];
        expect(set.mode).toBe("set_complete");
        expect(set.currentLesson).toBeNull();
        expect(set.percentComplete).toBe(100);
    });
});

describe("buildPersonalPath — lesson detail (stars, mastery, dots)", () => {
    it("derives stars from the stored score", () => {
        const sets = [setInput("s", "S", ["01.json"])];
        const result = build({
            sets,
            progress: {
                [lessonKey("s", "01.json")]: progress("s", "01.json", {
                    score_correct: 10,
                    score_total: 10,
                }),
            },
        });
        expect(result.activeSets[0].lessons[0].stars).toBe(3);
    });

    it("maps dot states: done / in_progress / not_started", () => {
        const sets = [setInput("s", "S", ["01.json", "02.json", "03.json"])];
        const result = build({
            sets,
            progress: {
                [lessonKey("s", "01.json")]: progress("s", "01.json"),
                [lessonKey("s", "02.json")]: progress("s", "02.json", {
                    status: "in_progress",
                    completed_at: null,
                }),
            },
        });
        const dots = result.activeSets[0].lessons.map((l) => l.dot);
        expect(dots).toEqual(["done", "in_progress", "not_started"]);
    });

    it("tracks per-direction mastery from element errors", () => {
        const sets = [setInput("s", "S", ["01.json"])];
        const key = lessonKey("s", "01.json");
        const result = build({
            sets,
            progress: {[key]: progress("s", "01.json")},
            errors: {
                [key]: [
                    errorRow("s", "01.json", {
                        direction: "target_to_source",
                        mastered: true,
                    }),
                    errorRow("s", "01.json", {
                        direction: "source_to_target",
                        mastered: false,
                    }),
                ],
            },
        });
        const lesson = result.activeSets[0].lessons[0];
        expect(lesson.receptive).toBe("mastered");
        expect(lesson.productive).toBe("in_progress");
        // Both directions mastered → status mastered; here only one is.
        expect(lesson.status).toBe("completed");
    });

    it("reports na mastery for a lesson with no tracked errors", () => {
        const sets = [setInput("s", "S", ["01.json"])];
        const result = build({
            sets,
            progress: {
                [lessonKey("s", "01.json")]: progress("s", "01.json"),
            },
        });
        const lesson = result.activeSets[0].lessons[0];
        expect(lesson.receptive).toBe("na");
        expect(lesson.productive).toBe("na");
    });

    it("flips a completed lesson to mastered when both directions are mastered", () => {
        const sets = [setInput("s", "S", ["01.json"])];
        const key = lessonKey("s", "01.json");
        const result = build({
            sets,
            progress: {[key]: progress("s", "01.json")},
            errors: {
                [key]: [
                    errorRow("s", "01.json", {
                        direction: "target_to_source",
                        mastered: true,
                    }),
                    errorRow("s", "01.json", {
                        direction: "source_to_target",
                        mastered: true,
                    }),
                ],
            },
        });
        expect(result.activeSets[0].lessons[0].status).toBe("mastered");
    });

    it("counts active (non-mastered) errors per set", () => {
        const sets = [setInput("s", "S", ["01.json", "02.json"])];
        const result = build({
            sets,
            progress: {
                [lessonKey("s", "01.json")]: progress("s", "01.json"),
            },
            errors: {
                [lessonKey("s", "01.json")]: [
                    errorRow("s", "01.json", {mastered: false}),
                    errorRow("s", "01.json", {mastered: false}),
                    errorRow("s", "01.json", {mastered: true}),
                ],
            },
        });
        expect(result.activeSets[0].errorCount).toBe(2);
    });
});

describe("buildPersonalPath — next level", () => {
    it("points a completed A1 set at an available (not-downloaded) A2", () => {
        const sets = [
            setInput("fra1", "Französisch A1", ["01.json"], {
                level: "a1",
                domain: "language",
                source_language: "de",
                target_language: "fr",
            }),
        ];
        const result = build({
            sets,
            progress: {
                [lessonKey("fra1", "01.json")]: progress("fra1", "01.json"),
            },
            notDownloaded: [
                entry({
                    id: "fra2",
                    title: "Französisch A2",
                    level: "a2",
                    domain: "language",
                    source_language: "de",
                    target_language: "fr",
                    cached_version: null,
                }),
            ],
        });
        const set = result.activeSets[0];
        expect(set.nextLevel?.setId).toBe("fra2");
        expect(set.nextLevel?.downloaded).toBe(false);
    });

    it("leaves nextLevel null when no higher level exists", () => {
        const sets = [
            setInput("fra1", "Französisch A1", ["01.json"], {level: "a1"}),
        ];
        const result = build({sets});
        expect(result.activeSets[0].nextLevel).toBeNull();
    });

    it("matches the next level only for the same language pair + domain", () => {
        const sets = [
            setInput("fra1", "Französisch A1", ["01.json"], {
                level: "a1",
                source_language: "de",
                target_language: "fr",
                domain: "language",
            }),
        ];
        const result = build({
            sets,
            notDownloaded: [
                entry({
                    id: "esa2",
                    title: "Spanisch A2",
                    level: "a2",
                    source_language: "de",
                    target_language: "es",
                    domain: "language",
                    cached_version: null,
                }),
            ],
        });
        expect(result.activeSets[0].nextLevel).toBeNull();
    });
});

describe("buildPersonalPath — not-downloaded section", () => {
    it("lists not-downloaded sets sorted by domain then title", () => {
        const result = build({
            notDownloaded: [
                entry({id: "frb", title: "Französisch A2", domain: "language", lesson_count: 15}),
                entry({id: "psy91", title: "Psychologie 91+", domain: "psychology", lesson_count: 10}),
                entry({id: "fra", title: "Englisch A2", domain: "language", lesson_count: 12}),
            ],
        });
        expect(result.notDownloadedSets.map((s) => s.title)).toEqual([
            "Englisch A2",
            "Französisch A2",
            "Psychologie 91+",
        ]);
        expect(result.notDownloadedSets[0].lessonCount).toBe(12);
    });

    it("is empty when everything is downloaded", () => {
        const result = build({sets: [setInput("s", "S", ["01.json"])]});
        expect(result.notDownloadedSets).toEqual([]);
    });
});
