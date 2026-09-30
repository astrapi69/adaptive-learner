/**
 * #3225 (the #2703 class, the other three runners): the fetch effect of the
 * shuffle, endless and adaptive hooks must not restart merely because the
 * DISPLAY ``title`` or ``description`` changed between renders.
 *
 * The callers pass ``t("...", "English fallback")``: on first paint that is
 * the fallback, once the async i18n catalog resolves it flips to the
 * translated string. With the string in the dependency array the flip tore a
 * ready session down to "loading" and re-ran the whole load (a new shuffle
 * order, a new endless plan, a re-synthesised adaptive lesson) after the
 * learner had already started.
 *
 * Pinned per hook: a title (and description) change alone touches no storage
 * call and leaves the hook in its settled state; where the hook has a
 * ``reload()``, that explicit action still refetches with the current title.
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import type {ContentLesson, ElementError} from "../../../storage/types";

const listSetsMock = vi.fn();
const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const listErrorsMock = vi.fn();

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            list: listErrorsMock,
            reviewQueue: vi.fn().mockResolvedValue([]),
            recordBulk: vi.fn().mockResolvedValue([]),
        },
        contentLoader: {
            listSets: listSetsMock,
            listLessons: listLessonsMock,
            getLesson: getLessonMock,
        },
    }),
}));

vi.mock("../../../lib/review/review-queue", () => ({
    loadReviewQueue: vi.fn().mockResolvedValue([]),
}));

import {useAdaptiveLesson} from "./useAdaptiveLesson";
import {useEndlessLesson} from "./useEndlessLesson";
import {useShuffleLesson} from "./useShuffleLesson";

const SET_ID = "es-a1";
const NOW = "2026-07-15T00:00:00.000Z";

function clozeLesson(file: string, exerciseCount: number): ContentLesson {
    return {
        id: file,
        title: file,
        estimated_minutes: 1,
        cards: [],
        steps: Array.from({length: exerciseCount}, (_, i) => ({
            id: `${file}-s${i}`,
            type: "exercise",
            title: null,
            exercise: {id: `${file}-ex${i}`, type: "cloze", prompt: "p", card_ids: []},
        })),
    } as unknown as ContentLesson;
}

/** A lesson whose free-text exercise the adaptive pipeline can re-target. */
function adaptiveLesson(): ContentLesson {
    return {
        id: "03-zeit.json",
        title: "Zeit",
        description: null,
        estimated_minutes: 10,
        cards: [
            {id: "verletzlichkeit", front: "Freiwillige Verletzlichkeit", back: "…", tags: []},
        ],
        steps: [
            {id: "s1", type: "theory", title: "T", body: "Theorie."},
            {
                id: "s3",
                type: "exercise",
                title: null,
                exercise: {
                    id: "e-verletzlichkeit",
                    type: "free_text",
                    prompt: "Vertrauen ist keine Kontrolle, sondern freiwillige ___?",
                    card_ids: ["verletzlichkeit"],
                    accept: ["Freiwillige Verletzlichkeit"],
                    distractors: ["Sicherheit", "Gewissheit"],
                },
            },
        ],
    };
}

function elementError(): ElementError {
    return {
        id: "err-1",
        user_id: "user-1",
        set_id: SET_ID,
        lesson_id: "03-zeit.json",
        exercise_id: "e-verletzlichkeit",
        direction: "target_to_source",
        element_type: "vocabulary",
        user_answer: "x",
        correct_answer: "Verletzlichkeit",
        element_key: "Freiwillige Verletzlichkeit",
        error_count: 2,
        correct_streak: 0,
        last_error_at: NOW,
        last_attempt_at: NOW,
        mastered: false,
        mastered_at: null,
        created_at: NOW,
        updated_at: NOW,
    };
}

const LESSONS: Record<string, ContentLesson> = {
    "a.json": clozeLesson("a.json", 3),
    "b.json": clozeLesson("b.json", 3),
    "03-zeit.json": adaptiveLesson(),
};

beforeEach(() => {
    listSetsMock.mockReset();
    listLessonsMock.mockReset();
    getLessonMock.mockReset();
    listErrorsMock.mockReset();
    listSetsMock.mockResolvedValue({sets: [{id: SET_ID, source: "repo"}]});
    listLessonsMock.mockResolvedValue({lessons: ["a.json", "b.json"]});
    getLessonMock.mockImplementation(async (_s: string, _set: string, file: string) => {
        const lesson = LESSONS[file];
        if (!lesson) throw new Error(`no lesson ${file}`);
        return lesson;
    });
    listErrorsMock.mockResolvedValue([elementError()]);
});

/** Let any (incorrect) re-fetch get a chance to happen before asserting it didn't. */
async function flush(): Promise<void> {
    await act(async () => {
        await Promise.resolve();
    });
}

describe("#3225 useShuffleLesson: title/description are display-only", () => {
    it("a title and description change after ready does not reshuffle", async () => {
        const {result, rerender} = renderHook(
            ({title, description}: {title: string; description: string | null}) =>
                useShuffleLesson({setId: SET_ID, title, description, limit: 20}),
            {initialProps: {title: "Shuffle", description: null as string | null}},
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(listSetsMock).toHaveBeenCalledTimes(1);
        const order = result.current.lesson!.steps.map((s) => s.id);

        rerender({title: "Zufallsmodus", description: "Alles gemischt"});
        await flush();

        expect(result.current.status).toBe("ready");
        expect(listSetsMock).toHaveBeenCalledTimes(1);
        expect(listLessonsMock).toHaveBeenCalledTimes(1);
        expect(result.current.lesson!.steps.map((s) => s.id)).toEqual(order);
    });

    it("reload() still refetches and picks up the current title", async () => {
        const {result, rerender} = renderHook(
            ({title}: {title: string}) => useShuffleLesson({setId: SET_ID, title, limit: 20}),
            {initialProps: {title: "Shuffle"}},
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        rerender({title: "Zufallsmodus"});
        act(() => {
            result.current.reload();
        });
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(listSetsMock).toHaveBeenCalledTimes(2);
        expect(result.current.lesson?.title).toBe("Zufallsmodus");
    });
});

describe("#3225 useEndlessLesson: the title is display-only", () => {
    it("a title change after ready does not rebuild the plan", async () => {
        const {result, rerender} = renderHook(
            ({title}: {title: string}) => useEndlessLesson({setId: SET_ID, title}),
            {initialProps: {title: "Endless"}},
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(listSetsMock).toHaveBeenCalledTimes(1);
        const step = result.current.step!.id;

        rerender({title: "Endlosmodus"});
        await flush();

        expect(result.current.status).toBe("ready");
        expect(listSetsMock).toHaveBeenCalledTimes(1);
        expect(listLessonsMock).toHaveBeenCalledTimes(1);
        expect(result.current.step!.id).toBe(step);
    });
});

describe("#3225 useAdaptiveLesson: title/description are display-only", () => {
    it("a title and description change after ready does not re-synthesise", async () => {
        const {result, rerender} = renderHook(
            ({title, description}: {title: string; description: string | null}) =>
                useAdaptiveLesson({setId: SET_ID, title, description, limit: 20}),
            {initialProps: {title: "Adaptive", description: null as string | null}},
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(listErrorsMock).toHaveBeenCalledTimes(1);
        expect(listSetsMock).toHaveBeenCalledTimes(1);
        const lesson = result.current.lesson;

        rerender({title: "Adaptive Lektion", description: "Deine Schwachstellen"});
        await flush();

        expect(result.current.status).toBe("ready");
        expect(listErrorsMock).toHaveBeenCalledTimes(1);
        expect(listSetsMock).toHaveBeenCalledTimes(1);
        expect(result.current.lesson).toBe(lesson);
    });
});
