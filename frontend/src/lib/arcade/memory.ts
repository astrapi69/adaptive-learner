/**
 * Pure learn-memory reducer (#2887) - the content mini-game of the
 * game mode's arcade: pairs built from real lesson cards (term on the
 * front, translation on the back), revealed two at a time. Won when
 * every pair is locked.
 *
 * Deterministic and side-effect free: the deck shuffle takes a
 * ``rand`` source; the reducer returns the SAME state object for
 * no-op reveals so React consumers can bail out cheaply.
 */

export interface MemoryPairInput {
    front: string;
    back: string;
}

export interface MemoryCard {
    /** Unique card id (stable within the deck). */
    id: number;
    /** The pair this card belongs to (index into the input pairs). */
    pairId: number;
    text: string;
    side: "front" | "back";
}

export interface MemoryState {
    cards: MemoryCard[];
    /** Ids of the currently face-up, not-yet-locked cards (0-2). */
    revealed: number[];
    /** Locked pair ids, in match order. */
    matched: number[];
    /** Completed two-card reveals (the score to beat). */
    attempts: number;
    won: boolean;
}

/** Fisher-Yates over a copy, driven by ``rand`` in [0, 1). */
function shuffle<T>(items: T[], rand: () => number): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.min(i, Math.floor(rand() * (i + 1)));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** Pick up to ``count`` usable pairs from raw lesson cards: both
 *  sides non-empty, one pair per distinct front, order shuffled by
 *  ``rand`` so every round draws a different selection. */
export function drawMemoryPairs(
    cards: ReadonlyArray<{front: string; back: string}>,
    count: number,
    rand: () => number,
): MemoryPairInput[] {
    const seen = new Set<string>();
    const usable: MemoryPairInput[] = [];
    for (const card of cards) {
        const front = card.front.trim();
        const back = card.back.trim();
        if (!front || !back || seen.has(front)) continue;
        seen.add(front);
        usable.push({front, back});
    }
    return shuffle(usable, rand).slice(0, Math.max(0, count));
}

/** Two shuffled cards per input pair, ids unique across the deck. */
export function buildMemoryDeck(
    pairs: MemoryPairInput[],
    rand: () => number,
): MemoryCard[] {
    const cards: MemoryCard[] = [];
    pairs.forEach((pair, pairId) => {
        cards.push({
            id: pairId * 2,
            pairId,
            text: pair.front,
            side: "front",
        });
        cards.push({
            id: pairId * 2 + 1,
            pairId,
            text: pair.back,
            side: "back",
        });
    });
    return shuffle(cards, rand);
}

/** A fresh game over a shuffled deck of ``pairs``. */
export function initialMemory(
    pairs: MemoryPairInput[],
    rand: () => number,
): MemoryState {
    return {
        cards: buildMemoryDeck(pairs, rand),
        revealed: [],
        matched: [],
        attempts: 0,
        won: false,
    };
}

/** Reveal the card ``cardId``: open, match, or start the next try. */
export function revealCard(state: MemoryState, cardId: number): MemoryState {
    if (state.won) return state;
    const card = state.cards.find((c) => c.id === cardId);
    if (!card) return state;
    if (state.matched.includes(card.pairId)) return state;
    if (state.revealed.includes(cardId)) return state;

    // A standing mismatch (two open cards) folds away on the next
    // reveal - the classic "look, remember, move on" rhythm.
    const open =
        state.revealed.length === 2 ? [] : state.revealed;

    if (open.length === 0) {
        return {...state, revealed: [cardId]};
    }

    const first = state.cards.find((c) => c.id === open[0]);
    const attempts = state.attempts + 1;
    if (first && first.pairId === card.pairId) {
        const matched = [...state.matched, card.pairId];
        const totalPairs = state.cards.length / 2;
        return {
            ...state,
            revealed: [],
            matched,
            attempts,
            won: matched.length === totalPairs,
        };
    }
    return {...state, revealed: [...open, cardId], attempts};
}

/**
 * The set the memory dropdown should preselect (#2899): the most
 * recently learned set that is still cached (the caller passes the
 * continue-learning recency order), else the first cached set - the
 * game belongs to the active topic, not to whatever sorts first.
 *
 * @example
 * preferredMemorySetId(["en-a1", "psy"], ["psy", "en-a1"]) // "psy"
 */
export function preferredMemorySetId(
    cachedIds: readonly string[],
    recentSetIds: readonly string[],
): string | null {
    const cached = new Set(cachedIds);
    for (const id of recentSetIds) {
        if (cached.has(id)) return id;
    }
    return cachedIds[0] ?? null;
}
