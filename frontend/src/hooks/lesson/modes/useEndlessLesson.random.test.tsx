/**
 * #3214 independence, part 1 (Endless): under the visual random pin the
 * repetition phase depends only on the pin and the plan, never on how many
 * draws other consumers made from ``Math.random`` between advances.
 *
 * The fixture marks every exercise as seen and none as due, so the opening
 * queue is empty and every card, the first one included, comes from the
 * random repetition phase. Reproduction: ``advance`` passed no ``rng``, so
 * ``endlessStepAt`` drew from the page's shared ``Math.random`` stream.
 *
 * The clock is pinned out as well: under the pin the sequence at any other
 * instant equals the sequence at the frozen visual instant, so a stream seed
 * that mixed in the date would fail here.
 *
 * The production direction is pinned too: without the pin ``endlessStepAt``
 * gets no ``rng``, so ``Math.random`` is consumed and drives the repetitions.
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {endlessStepAt} from "../../../lib/endless/endless-stream";
import {mulberry32} from "../../../lib/random";
import type {ContentLesson} from "../../../storage/types";
import {
    FROZEN_VISUAL_NOW,
    OTHER_INSTANTS,
    clearRandomPin,
    installVisualRandomPin,
} from "../../../test-utils/visual-random-pin";

const hoisted = vi.hoisted(() => ({
    lessons: {} as Record<string, unknown>,
    seenIds: [] as string[],
}));

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            list: vi.fn().mockImplementation(async () =>
                hoisted.seenIds.map((exercise_id) => ({exercise_id})),
            ),
            recordBulk: vi.fn().mockResolvedValue([]),
        },
        contentLoader: {
            listSets: vi.fn().mockResolvedValue({sets: [{id: "set-1", source: "repo"}]}),
            listLessons: vi.fn().mockImplementation(async () => ({
                lessons: Object.keys(hoisted.lessons),
            })),
            getLesson: vi
                .fn()
                .mockImplementation(async (_s: string, _set: string, file: string) => hoisted.lessons[file]),
        },
    }),
}));

vi.mock("../../../lib/endless/endless-stream", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../../../lib/endless/endless-stream")>();
    return {...actual, endlessStepAt: vi.fn(actual.endlessStepAt)};
});

vi.mock("../../../lib/review/review-queue", () => ({
    loadReviewQueue: vi.fn().mockResolvedValue([]),
}));

import {useEndlessLesson} from "./useEndlessLesson";

const ADVANCES = 6;
const originalRandom = Math.random;

function lessonOf(file: string, exerciseCount: number): ContentLesson {
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

async function streamIds(foreignDrawsPerAdvance: number): Promise<string[]> {
    Math.random = mulberry32(0x1567);
    return renderStream(foreignDrawsPerAdvance);
}

/** The stream with only ``Date`` frozen at ``now`` (timers stay real, so
 *  ``waitFor`` keeps polling). */
async function streamIdsAt(now: number): Promise<string[]> {
    vi.useFakeTimers({toFake: ["Date"]});
    vi.setSystemTime(now);
    try {
        expect(Date.now()).toBe(now);
        return await streamIds(0);
    } finally {
        vi.useRealTimers();
    }
}

/** Render with ``Math.random`` replaced by a spy over its own seeded stream. */
async function streamWithRandomSeed(
    seed: number,
): Promise<{ids: string[]; random: ReturnType<typeof vi.fn>}> {
    const random = vi.fn(mulberry32(seed));
    Math.random = random;
    return {ids: await renderStream(0), random};
}

async function renderStream(foreignDrawsPerAdvance: number): Promise<string[]> {
    const {result, unmount} = renderHook(() =>
        useEndlessLesson({setId: "set-1", title: "Endless"}),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const ids = [result.current.step!.id];
    for (let n = 0; n < ADVANCES; n++) {
        for (let i = 0; i < foreignDrawsPerAdvance; i++) Math.random();
        act(() => result.current.advance());
        ids.push(result.current.step!.id);
    }
    unmount();
    return ids;
}

beforeEach(() => {
    hoisted.lessons = {
        "a.json": lessonOf("a.json", 4),
        "b.json": lessonOf("b.json", 4),
    };
    hoisted.seenIds = Object.keys(hoisted.lessons).flatMap((file) =>
        Array.from({length: 4}, (_, i) => `${file}-ex${i}`),
    );
});

afterEach(() => {
    Math.random = originalRandom;
    vi.useRealTimers();
    clearRandomPin();
    vi.mocked(endlessStepAt).mockClear();
});

describe("Endless repetition under the visual random pin (#3214)", () => {
    it.each([
        {name: "no draws between advances", foreignDraws: 0},
        {name: "3 draws before each advance", foreignDraws: 3},
        {name: "17 draws before each advance", foreignDraws: 17},
    ])("is independent of foreign Math.random draws: $name", async ({foreignDraws}) => {
        installVisualRandomPin();
        const reference = await streamIds(0);
        expect(await streamIds(foreignDraws)).toEqual(reference);
    });

    it.each(OTHER_INSTANTS)(
        "ignores the clock: at $name the sequence equals the frozen visual clock's",
        async ({now}) => {
            installVisualRandomPin();
            const atFrozenClock = await streamIdsAt(FROZEN_VISUAL_NOW);
            expect(await streamIdsAt(now)).toEqual(atFrozenClock);
        },
    );

    it("sensitivity guard: without a pin the shared stream does move the sequence", async () => {
        const reference = await streamIds(0);
        expect(await streamIds(17)).not.toEqual(reference);
    });
});

describe("Endless repetition in production, without a pin (#3214)", () => {
    it("hands endlessStepAt no rng, so its Math.random default applies", async () => {
        await streamIds(0);
        const calls = vi.mocked(endlessStepAt).mock.calls;
        expect(calls.length).toBeGreaterThan(1);
        for (const call of calls) expect(call[3]).toBeUndefined();
    });

    it("consumes Math.random and lets it drive the repetitions", async () => {
        const first = await streamWithRandomSeed(1);
        const again = await streamWithRandomSeed(1);
        const other = await streamWithRandomSeed(2);
        expect(first.random).toHaveBeenCalled();
        expect(again.ids).toEqual(first.ids);
        expect(other.ids).not.toEqual(first.ids);
    });

    it("under the pin the repetitions never touch Math.random", async () => {
        installVisualRandomPin();
        const {random} = await streamWithRandomSeed(1);
        expect(random).not.toHaveBeenCalled();
    });
});
