/**
 * Tests for the pure simon logic (#2907).
 *
 * Pins the reducer contract: injected randomness for the sequence,
 * tick-driven playback (lit/gap alternation like the snake tick),
 * input phase advancing per correct pad, a friendly loss carrying
 * the reached length, and the win at the target length.
 */

import {describe, expect, it} from "vitest";

import {
    SIMON_PAD_COUNT,
    type SimonState,
    initialSimon,
    pressPad,
    stepPlayback,
} from "./simon";

/** A rand source yielding the given values in order (then 0). */
function seeded(values: number[]): () => number {
    let i = 0;
    return () => values[i++] ?? 0;
}

/** Run playback ticks until the input phase opens (bounded). */
function playThrough(state: SimonState): SimonState {
    let next = state;
    for (let i = 0; i < 50 && next.phase === "playback"; i++) {
        next = stepPlayback(next);
    }
    expect(next.phase).toBe("input");
    return next;
}

describe("initialSimon (#2907)", () => {
    it("starts a playback round with one pad from the rand source", () => {
        const low = initialSimon(8, seeded([0]));
        expect(low.sequence).toEqual([0]);
        expect(low.phase).toBe("playback");
        expect(low.litPad).toBeNull();
        expect(low.target).toBe(8);
        expect(low.reached).toBe(0);

        const high = initialSimon(8, seeded([0.999]));
        expect(high.sequence).toEqual([SIMON_PAD_COUNT - 1]);
    });
});

describe("stepPlayback (#2907)", () => {
    it("alternates lit and gap, then opens the input phase", () => {
        const start = initialSimon(8, seeded([0.3]));
        const lit = stepPlayback(start);
        expect(lit.litPad).toBe(start.sequence[0]);
        expect(lit.phase).toBe("playback");

        const done = stepPlayback(lit);
        expect(done.litPad).toBeNull();
        expect(done.phase).toBe("input");
        expect(done.inputIndex).toBe(0);
    });

    it("plays a longer sequence pad by pad before the input opens", () => {
        const base = initialSimon(8, seeded([0]));
        const grown: SimonState = {...base, sequence: [1, 3, 2]};
        const litPads: number[] = [];
        let state: SimonState = grown;
        for (let i = 0; i < 20 && state.phase === "playback"; i++) {
            state = stepPlayback(state);
            if (state.litPad !== null) litPads.push(state.litPad);
        }
        expect(litPads).toEqual([1, 3, 2]);
        expect(state.phase).toBe("input");
    });

    it("is a no-op outside the playback phase", () => {
        const input = playThrough(initialSimon(8, seeded([0])));
        expect(stepPlayback(input)).toBe(input);
    });
});

describe("pressPad (#2907)", () => {
    it("advances the input index on a correct mid-sequence press", () => {
        const base = playThrough(initialSimon(8, seeded([0])));
        const twoLong = playThrough({
            ...base,
            phase: "playback",
            playIndex: -1,
            sequence: [2, 0],
        });
        const after = pressPad(twoLong, 2, seeded([0]));
        expect(after.phase).toBe("input");
        expect(after.inputIndex).toBe(1);
    });

    it("extends the sequence with the injected rand after a full round", () => {
        const input = playThrough(initialSimon(2, seeded([0.3])));
        const first = input.sequence[0];
        const after = pressPad(input, first, seeded([0.999]));
        expect(after.phase).toBe("playback");
        expect(after.sequence).toEqual([first, SIMON_PAD_COUNT - 1]);
        expect(after.reached).toBe(1);
        expect(after.inputIndex).toBe(0);
        expect(after.litPad).toBeNull();
    });

    it("wins when the completed round reaches the target length", () => {
        const start = initialSimon(2, seeded([0]));
        const grown = playThrough({...start, sequence: [1, 2]});
        const mid = pressPad(grown, 1, seeded([0]));
        const done = pressPad(mid, 2, seeded([0]));
        expect(done.phase).toBe("won");
        expect(done.reached).toBe(2);
    });

    it("ends friendly on a wrong pad, keeping the reached length", () => {
        const start = initialSimon(8, seeded([0]));
        const grown = playThrough({...start, sequence: [1, 2, 3]});
        const lost = pressPad(grown, 0, seeded([0]));
        expect(lost.phase).toBe("lost");
        expect(lost.reached).toBe(2);
    });

    it("is a no-op outside the input phase", () => {
        const playback = initialSimon(8, seeded([0]));
        expect(pressPad(playback, 0, seeded([0]))).toBe(playback);
    });
});
