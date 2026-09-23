/**
 * #3214 independence, part 1 (Shuffle): under the visual random pin the
 * shuffled order depends only on the pin and the sources, never on how many
 * draws other consumers made from ``Math.random`` before the build.
 *
 * The visual harness replaces ``Math.random`` with ONE shared seeded stream
 * for the whole page; this test does the same (a mulberry32 stream at the
 * harness seed, reset per case) and burns ``k`` draws before rendering the
 * hook. Reproduction: the hook passed no ``rng``, so the builder drew from
 * the shared stream and every foreign draw shifted the order.
 *
 * The clock is pinned out as well: under the pin the order at any other
 * instant equals the order at the frozen visual instant, so a stream seed
 * that mixed in the date would fail here.
 *
 * The production direction is pinned too: without the pin the hook hands
 * the builder no ``rng`` at all, so ``Math.random`` is consumed and drives
 * the order, and a learner gets a new shuffle every time.
 */

import {renderHook, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {mulberry32, pinnedRandom} from "../../../lib/random";
import {buildShuffleLesson} from "../../../lib/shuffle/shuffle-lesson";
import type {ContentLesson} from "../../../storage/types";
import {
    FROZEN_VISUAL_NOW,
    OTHER_INSTANTS,
    clearRandomPin,
    installVisualRandomPin,
} from "../../../test-utils/visual-random-pin";

const hoisted = vi.hoisted(() => ({lessons: {} as Record<string, unknown>}));

vi.mock("../../../lib/shuffle/shuffle-lesson", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../../../lib/shuffle/shuffle-lesson")>();
    return {...actual, buildShuffleLesson: vi.fn(actual.buildShuffleLesson)};
});

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {recordBulk: vi.fn().mockResolvedValue([])},
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

import {useShuffleLesson} from "./useShuffleLesson";

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

/** Install the harness shape: one shared seeded Math.random stream. */
function installSharedStream(): void {
    Math.random = mulberry32(0x1567);
}

async function renderShuffledIds(): Promise<string[]> {
    const {result, unmount} = renderHook(() =>
        useShuffleLesson({setId: "set-1", title: "Shuffle"}),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const ids = result.current.lesson!.steps.map((s) => s.exercise!.id);
    unmount();
    return ids;
}

async function shuffledExerciseIds(foreignDraws: number): Promise<string[]> {
    installSharedStream();
    for (let i = 0; i < foreignDraws; i++) Math.random();
    return renderShuffledIds();
}

/** The shuffled order with only ``Date`` frozen at ``now`` (timers stay real,
 *  so ``waitFor`` keeps polling). */
async function shuffledAt(now: number): Promise<string[]> {
    vi.useFakeTimers({toFake: ["Date"]});
    vi.setSystemTime(now);
    try {
        expect(Date.now()).toBe(now);
        return await shuffledExerciseIds(0);
    } finally {
        vi.useRealTimers();
    }
}

/** Render with ``Math.random`` replaced by a spy over its own seeded stream. */
async function shuffledWithRandomSeed(
    seed: number,
): Promise<{ids: string[]; random: ReturnType<typeof vi.fn>}> {
    const random = vi.fn(mulberry32(seed));
    Math.random = random;
    return {ids: await renderShuffledIds(), random};
}

beforeEach(() => {
    hoisted.lessons = {
        "a.json": lessonOf("a.json", 4),
        "b.json": lessonOf("b.json", 4),
        "c.json": lessonOf("c.json", 4),
    };
});

afterEach(() => {
    Math.random = originalRandom;
    vi.useRealTimers();
    clearRandomPin();
    vi.mocked(buildShuffleLesson).mockClear();
});

describe("Shuffle order under the visual random pin (#3214)", () => {
    it.each([
        {name: "no prior draws", foreignDraws: 0},
        {name: "7 prior draws", foreignDraws: 7},
        {name: "31 prior draws", foreignDraws: 31},
    ])("is independent of foreign Math.random draws: $name", async ({foreignDraws}) => {
        installVisualRandomPin();
        const reference = await shuffledExerciseIds(0);
        expect(await shuffledExerciseIds(foreignDraws)).toEqual(reference);
    });

    it("is independent of draws from another pinned stream", async () => {
        installVisualRandomPin();
        const reference = await shuffledExerciseIds(0);
        const endless = pinnedRandom("endless-repeat")!;
        for (let i = 0; i < 13; i++) endless();
        expect(await shuffledExerciseIds(0)).toEqual(reference);
    });

    it.each(OTHER_INSTANTS)(
        "ignores the clock: at $name the order equals the frozen visual clock's",
        async ({now}) => {
            installVisualRandomPin();
            const atFrozenClock = await shuffledAt(FROZEN_VISUAL_NOW);
            expect(await shuffledAt(now)).toEqual(atFrozenClock);
        },
    );

    it("sensitivity guard: without a pin the shared stream does move the order", async () => {
        const reference = await shuffledExerciseIds(0);
        expect(await shuffledExerciseIds(31)).not.toEqual(reference);
    });
});

describe("Shuffle order in production, without a pin (#3214)", () => {
    it("hands the builder no rng, so its Math.random default applies", async () => {
        await shuffledExerciseIds(0);
        const opts = vi.mocked(buildShuffleLesson).mock.calls[0][1];
        expect(opts).toBeDefined();
        expect(opts!.rng).toBeUndefined();
    });

    it("consumes Math.random and lets it drive the order", async () => {
        const first = await shuffledWithRandomSeed(1);
        const again = await shuffledWithRandomSeed(1);
        const other = await shuffledWithRandomSeed(2);
        expect(first.random).toHaveBeenCalled();
        expect(again.ids).toEqual(first.ids);
        expect(other.ids).not.toEqual(first.ids);
    });

    it("under the pin the builder never touches Math.random", async () => {
        installVisualRandomPin();
        const {random} = await shuffledWithRandomSeed(1);
        expect(random).not.toHaveBeenCalled();
    });
});
