/**
 * #2161 orchestration: assess (content-verified), restore, restart. Mocks the
 * mode-agnostic getStorage facade + learner state, so it covers both modes.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {
    assessJkzRecovery,
    restartRecoverySet,
    restoreRecoverySet,
} from "./jkz-recovery-service";

const readLearnerState = vi.fn();
const listErrors = vi.fn();
const remapKeys = vi.fn();
const getLesson = vi.fn();
const listProgress = vi.fn();
const deleteLearningData = vi.fn();

vi.mock("../../learning/learnerState", () => ({
    readLearnerState: () => readLearnerState(),
}));
vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {list: listErrors, remapKeys},
        contentLoader: {getLesson},
        lessonProgress: {list: listProgress},
        learningData: {deleteLearningData},
    }),
}));

// A real incident entry (present in the shipped mapping table).
const SET = "ja-a1-from-de";
const LESSON = "01-begruessungen.json";
const EX = "ex-match-begruessung";
const OLD = "こんにちは";
const NEW = "こんにちは (konnichiwa)";

const orphanRow = {set_id: SET, lesson_id: LESSON, exercise_id: EX, element_key: OLD};

/** A cached lesson whose exercise currently carries `key` as its answer. */
const lessonWith = (key: string) => ({
    steps: [{exercise: {id: EX, type: "matching", pairs: [{left: key}]}}],
});

beforeEach(() => {
    vi.clearAllMocks();
    readLearnerState.mockReturnValue({userId: "u1"});
    listErrors.mockResolvedValue([]);
    listProgress.mockResolvedValue([]);
    remapKeys.mockResolvedValue({applied: 1, skipped: 0});
    getLesson.mockResolvedValue(lessonWith(NEW));
});

describe("assessJkzRecovery (#2161)", () => {
    it("returns null when there is no user", async () => {
        readLearnerState.mockReturnValue({userId: null});
        expect(await assessJkzRecovery()).toBeNull();
    });

    it("returns null when the learner has no affected rows", async () => {
        listErrors.mockResolvedValue([{...orphanRow, element_key: "unrelated"}]);
        expect(await assessJkzRecovery()).toBeNull();
    });

    it("reports applicable remaps when the new key exists in current content", async () => {
        listErrors.mockResolvedValue([orphanRow]);
        const a = await assessJkzRecovery();
        expect(a?.applicableCount).toBe(1);
        expect(a?.unmappableCount).toBe(0);
        expect(a?.affectedSets).toEqual([SET]);
    });

    it("reports UNMAPPABLE (not applicable) when the set changed again since the snapshot", async () => {
        listErrors.mockResolvedValue([orphanRow]);
        getLesson.mockResolvedValue(lessonWith("something else")); // new key gone
        const a = await assessJkzRecovery();
        expect(a?.applicableCount).toBe(0);
        expect(a?.unmappableCount).toBe(1);
        expect(a?.affectedSets).toEqual([]);
    });
});

describe("restoreRecoverySet / restartRecoverySet (#2161)", () => {
    it("restore applies the set's content-verified remaps and returns counts", async () => {
        listErrors.mockResolvedValue([orphanRow]);
        const outcome = await restoreRecoverySet(SET);
        expect(remapKeys).toHaveBeenCalledWith("u1", [
            {set_id: SET, lesson_id: LESSON, exercise_id: EX, old: OLD, new: NEW},
        ]);
        expect(outcome).toEqual({applied: 1, skipped: 0, unmapped: 0});
    });

    it("restore is a no-op when nothing is applicable (idempotent flow)", async () => {
        listErrors.mockResolvedValue([]); // already restored
        const outcome = await restoreRecoverySet(SET);
        expect(remapKeys).not.toHaveBeenCalled();
        expect(outcome.applied).toBe(0);
    });

    it("restart deletes the set's progress + review cards", async () => {
        listProgress.mockResolvedValue([
            {id: "p1", source: "astrapi69/adaptive-learner-content", set_id: SET},
            {id: "other", source: "astrapi69/adaptive-learner-content", set_id: "en-a1"},
        ]);
        deleteLearningData.mockResolvedValue({lessonsDeleted: 1, cardsDeleted: 3});
        await restartRecoverySet(SET);
        expect(deleteLearningData).toHaveBeenCalledWith("u1", {
            lessonProgressIds: ["p1"],
            setIds: [SET],
        });
    });
});
