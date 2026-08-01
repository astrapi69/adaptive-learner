/**
 * Tests for assessSetUpdate (#2128 guard orchestration). Mode-agnostic: the
 * guard reads through the getStorage facade, so simulating the rows a backing
 * returns covers both API and Dexie mode (the decision path is identical).
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {assessSetUpdate} from "./assess-set-update";

const readLearnerState = vi.fn();
const listProgress = vi.fn();
const listErrors = vi.fn();
const peek = vi.fn();

vi.mock("../../learning/learnerState", () => ({
    readLearnerState: () => readLearnerState(),
}));
vi.mock("../../../storage", () => ({
    getStorage: () => ({
        lessonProgress: {list: listProgress},
        elementErrors: {list: listErrors},
    }),
}));
vi.mock("../../../storage/content/peek-set", () => ({
    peekSetLessons: (...args: unknown[]) => peek(...args),
}));

beforeEach(() => {
    readLearnerState.mockReset();
    listProgress.mockReset();
    listErrors.mockReset();
    peek.mockReset();
    readLearnerState.mockReturnValue({userId: "u1"});
    listProgress.mockResolvedValue([]);
    listErrors.mockResolvedValue([]);
});

describe("assessSetUpdate (#2128)", () => {
    it("returns null when there is no active user", async () => {
        readLearnerState.mockReturnValue({userId: null});
        expect(await assessSetUpdate("owner/repo", "ja-a1")).toBeNull();
    });

    it("returns null (safe) when the learner has no progress/SRS in the set", async () => {
        listProgress.mockResolvedValue([
            {source: "owner/repo", set_id: "OTHER", lesson_filename: "01.json"},
        ]);
        expect(await assessSetUpdate("owner/repo", "ja-a1")).toBeNull();
        expect(peek).not.toHaveBeenCalled(); // no peek when nothing to protect
    });

    it("flags a breaking update (element_key vanished) for a set the learner practices", async () => {
        listErrors.mockResolvedValue([
            {set_id: "ja-a1", lesson_id: "01.json", exercise_id: "ex-pic-1", element_key: "さようなら"},
        ]);
        peek.mockResolvedValue(([
                {
                    filename: "01.json",
                    exercises: [
                        {id: "ex-pic-1", type: "picture_choice", images: [{label: "さようなら (sayounara)", is_correct: "true", src: "a.png"}]},
                    ],
                },
            ]),
        );
        const impact = await assessSetUpdate("owner/repo", "ja-a1");
        expect(impact?.impact.breaking).toBe(true);
        expect(impact?.impact.lostCards).toHaveLength(1);
    });

    it("does NOT flag a harmless (superset) update", async () => {
        listErrors.mockResolvedValue([
            {set_id: "ja-a1", lesson_id: "01.json", exercise_id: "ex-free-1", element_key: "arigato"},
        ]);
        peek.mockResolvedValue(([
                {
                    filename: "01.json",
                    exercises: [{id: "ex-free-1", type: "free_text", accept: ["arigato", "arigatou"]}],
                },
            ]),
        );
        const impact = await assessSetUpdate("owner/repo", "ja-a1");
        expect(impact?.impact.breaking).toBe(false);
    });
});
