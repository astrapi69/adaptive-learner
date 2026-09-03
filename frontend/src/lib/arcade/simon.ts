/**
 * Pure simon game logic (#2907) - the arcade's color-sequence memory
 * game. Deterministic and side-effect free like the snake reducer:
 * the caller owns the playback tick timer and passes a ``rand``
 * source, so sequence growth and every phase transition are
 * unit-testable.
 *
 * Playback is tick-driven: each ``stepPlayback`` call alternates
 * between lighting the next sequence pad and a gap, so the caller
 * renders one lit pad per tick pair. A wrong press ends the run
 * friendly, keeping the reached length; completing a round at the
 * target length wins.
 */

export const SIMON_PAD_COUNT = 4;

export type SimonPhase = "playback" | "input" | "won" | "lost";

export interface SimonState {
    /** Pad indices 0..3, in playback order. */
    sequence: number[];
    phase: SimonPhase;
    /** Index of the sequence pad shown last during playback. */
    playIndex: number;
    /** Pad currently lit during playback, null in the gaps. */
    litPad: number | null;
    /** Next sequence position the input phase expects. */
    inputIndex: number;
    /** Sequence length that wins the run. */
    target: number;
    /** Longest fully repeated sequence so far. */
    reached: number;
}

/** A pad index in [0, SIMON_PAD_COUNT) from a rand in [0, 1). */
function randPad(rand: () => number): number {
    return Math.min(
        SIMON_PAD_COUNT - 1,
        Math.floor(rand() * SIMON_PAD_COUNT),
    );
}

/** A fresh run: a one-pad sequence entering its playback. */
export function initialSimon(target: number, rand: () => number): SimonState {
    return {
        sequence: [randPad(rand)],
        phase: "playback",
        playIndex: -1,
        litPad: null,
        inputIndex: 0,
        target: Math.max(1, Math.round(target)),
        reached: 0,
    };
}

/** Advance one playback tick: light the next pad, or clear the lit
 *  pad (gap) - opening the input phase after the last pad's gap. */
export function stepPlayback(state: SimonState): SimonState {
    if (state.phase !== "playback") return state;
    if (state.litPad !== null) {
        const finished = state.playIndex >= state.sequence.length - 1;
        return {
            ...state,
            litPad: null,
            phase: finished ? "input" : "playback",
            inputIndex: 0,
        };
    }
    const nextIndex = state.playIndex + 1;
    return {
        ...state,
        playIndex: nextIndex,
        litPad: state.sequence[nextIndex],
    };
}

/** Apply a pad press in the input phase: advance, extend the
 *  sequence (via ``rand``) after a completed round, win at the
 *  target length, or end friendly on a wrong pad. */
export function pressPad(
    state: SimonState,
    pad: number,
    rand: () => number,
): SimonState {
    if (state.phase !== "input") return state;
    if (pad !== state.sequence[state.inputIndex]) {
        return {
            ...state,
            phase: "lost",
            litPad: null,
            reached: state.sequence.length - 1,
        };
    }
    const nextInput = state.inputIndex + 1;
    if (nextInput < state.sequence.length) {
        return {...state, inputIndex: nextInput};
    }
    const reached = state.sequence.length;
    if (reached >= state.target) {
        return {...state, phase: "won", litPad: null, reached};
    }
    return {
        ...state,
        sequence: [...state.sequence, randPad(rand)],
        phase: "playback",
        playIndex: -1,
        litPad: null,
        inputIndex: 0,
        reached,
    };
}
