/**
 * Tests for the pure learn-memory reducer (#2887): deck building from
 * card pairs, reveal/match/mismatch flow, attempt counting, the win
 * condition, and the no-op guards.
 */

import {describe, expect, it} from "vitest";

import {
    buildMemoryDeck,
    drawMemoryPairs,
    initialMemory,
    preferredMemorySetId,
    revealCard,
    type MemoryState,
} from "./memory";

const PAIRS = [
    {front: "der Hund", back: "the dog"},
    {front: "die Katze", back: "the cat"},
    {front: "das Haus", back: "the house"},
];

/** Deterministic rand: identity shuffle (always picks index 0 slot). */
const noShuffle = () => 0;

function findCardIds(
    state: MemoryState,
    pairId: number,
): {frontId: number; backId: number} {
    const front = state.cards.find(
        (c) => c.pairId === pairId && c.side === "front",
    );
    const back = state.cards.find(
        (c) => c.pairId === pairId && c.side === "back",
    );
    if (!front || !back) throw new Error(`pair ${pairId} missing`);
    return {frontId: front.id, backId: back.id};
}

describe("buildMemoryDeck", () => {
    it("builds two cards per pair, front and back, unique ids", () => {
        const deck = buildMemoryDeck(PAIRS, noShuffle);
        expect(deck).toHaveLength(6);
        const ids = new Set(deck.map((c) => c.id));
        expect(ids.size).toBe(6);
        for (let pairId = 0; pairId < PAIRS.length; pairId++) {
            const members = deck.filter((c) => c.pairId === pairId);
            expect(members).toHaveLength(2);
            expect(members.map((c) => c.side).sort()).toEqual([
                "back",
                "front",
            ]);
        }
        const texts = deck.map((c) => c.text);
        expect(texts).toContain("der Hund");
        expect(texts).toContain("the dog");
    });
});

describe("drawMemoryPairs", () => {
    const cards = [
        {front: "eins", back: "one"},
        {front: "zwei", back: "two"},
        {front: "eins", back: "one (dupe)"},
        {front: "", back: "empty front"},
        {front: "leer", back: ""},
        {front: "drei", back: "three"},
    ];

    it("filters empty sides, dedupes fronts, and caps at the requested count", () => {
        const pairs = drawMemoryPairs(cards, 2, noShuffle);
        expect(pairs).toHaveLength(2);
        for (const pair of pairs) {
            expect(pair.front).not.toBe("");
            expect(pair.back).not.toBe("");
        }
        const fronts = pairs.map((p) => p.front);
        expect(new Set(fronts).size).toBe(fronts.length);
    });

    it("returns every usable pair when fewer exist than requested", () => {
        const pairs = drawMemoryPairs(cards, 10, noShuffle);
        expect(pairs).toHaveLength(3);
        expect(pairs.map((p) => p.front).sort()).toEqual([
            "drei",
            "eins",
            "zwei",
        ]);
    });
});

describe("revealCard", () => {
    it("first reveal opens one card", () => {
        const state = initialMemory(PAIRS, noShuffle);
        const {frontId} = findCardIds(state, 0);
        const next = revealCard(state, frontId);
        expect(next.revealed).toEqual([frontId]);
        expect(next.attempts).toBe(0);
    });

    it("a matching second reveal locks the pair and counts the attempt", () => {
        const state = initialMemory(PAIRS, noShuffle);
        const {frontId, backId} = findCardIds(state, 0);
        const next = revealCard(revealCard(state, frontId), backId);
        expect(next.matched).toEqual([0]);
        expect(next.revealed).toEqual([]);
        expect(next.attempts).toBe(1);
        expect(next.won).toBe(false);
    });

    it("a mismatch stays visible until the next reveal clears it", () => {
        const state = initialMemory(PAIRS, noShuffle);
        const pair0 = findCardIds(state, 0);
        const pair1 = findCardIds(state, 1);
        const mismatch = revealCard(
            revealCard(state, pair0.frontId),
            pair1.backId,
        );
        expect(mismatch.revealed).toEqual([pair0.frontId, pair1.backId]);
        expect(mismatch.matched).toEqual([]);
        expect(mismatch.attempts).toBe(1);
        // The next reveal folds the mismatch away and opens the new card.
        const next = revealCard(mismatch, pair1.frontId);
        expect(next.revealed).toEqual([pair1.frontId]);
    });

    it("revealing the same or a matched card is a no-op", () => {
        const state = initialMemory(PAIRS, noShuffle);
        const {frontId, backId} = findCardIds(state, 0);
        const oneOpen = revealCard(state, frontId);
        expect(revealCard(oneOpen, frontId)).toBe(oneOpen);
        const locked = revealCard(oneOpen, backId);
        expect(revealCard(locked, frontId)).toBe(locked);
    });

    it("matching every pair wins the game", () => {
        let state = initialMemory(PAIRS, noShuffle);
        for (let pairId = 0; pairId < PAIRS.length; pairId++) {
            const {frontId, backId} = findCardIds(state, pairId);
            state = revealCard(revealCard(state, frontId), backId);
        }
        expect(state.won).toBe(true);
        expect(state.matched).toEqual([0, 1, 2]);
        expect(state.attempts).toBe(3);
        // A won game ignores further reveals.
        expect(revealCard(state, 0)).toBe(state);
    });
});

describe("preferredMemorySetId (#2899)", () => {
    it.each([
        [
            "picks the most recently learned cached set",
            ["en-a1", "psy-basics"],
            ["psy-basics", "en-a1"],
            "psy-basics",
        ],
        [
            "skips a recent set that is not cached any more",
            ["en-a1", "psy-basics"],
            ["deleted-set", "psy-basics"],
            "psy-basics",
        ],
        [
            "falls back to the first cached set without progress",
            ["en-a1", "psy-basics"],
            [],
            "en-a1",
        ],
        ["no cached sets yields null", [], ["psy-basics"], null],
    ])("%s", (_name, cachedIds, recentIds, expected) => {
        expect(preferredMemorySetId(cachedIds, recentIds)).toBe(expected);
    });
});
