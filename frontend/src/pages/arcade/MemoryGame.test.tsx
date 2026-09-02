/**
 * Tests for the MemoryGame component (#2887): loading real cards via
 * the storage abstraction (cached sets only, #1816), the
 * deterministic match/mismatch flow (card testids are pair-derived),
 * and the empty state. The reducer itself is pinned by
 * ``lib/arcade/memory.test.ts``.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import MemoryGame from "./MemoryGame";

const listSets = vi.fn();
const listLessons = vi.fn();
const getLesson = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            listSets: (...args: unknown[]) => listSets(...args),
            listLessons: (...args: unknown[]) => listLessons(...args),
            getLesson: (...args: unknown[]) => getLesson(...args),
        },
    }),
}));

function mockContent(cards: {front: string; back: string}[]) {
    listSets.mockResolvedValue({
        sets: [
            {
                source: "owner/repo",
                id: "set-1",
                title: "Set One",
                cached_version: "1.0.0",
            },
            {
                source: "owner/repo",
                id: "set-ghost",
                title: "Not downloaded",
                cached_version: null,
            },
        ],
    });
    listLessons.mockResolvedValue({lessons: ["01.json"]});
    getLesson.mockResolvedValue({cards});
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("MemoryGame", () => {
    it("loads cached sets only and renders two cards per pair", async () => {
        mockContent([
            {front: "eins", back: "one"},
            {front: "zwei", back: "two"},
        ]);
        render(<MemoryGame pairCount={2} />);
        const board = await screen.findByTestId("arcade-memory-board");
        expect(board.children).toHaveLength(4);
        const select = screen.getByTestId("arcade-memory-set");
        expect(select).toHaveTextContent("Set One");
        expect(select).not.toHaveTextContent("Not downloaded");
    });

    it("revealing a pair locks it and advances the progress", async () => {
        mockContent([
            {front: "eins", back: "one"},
            {front: "zwei", back: "two"},
        ]);
        render(<MemoryGame pairCount={2} />);
        await screen.findByTestId("arcade-memory-board");
        fireEvent.click(screen.getByTestId("arcade-memory-card-0"));
        fireEvent.click(screen.getByTestId("arcade-memory-card-1"));
        expect(screen.getByTestId("arcade-memory-card-0")).toBeDisabled();
        expect(screen.getByTestId("arcade-memory-progress")).toHaveTextContent(
            "Pairs: 1 / 2",
        );
    });

    it("matching every pair shows the win message with the try count", async () => {
        mockContent([
            {front: "eins", back: "one"},
            {front: "zwei", back: "two"},
        ]);
        render(<MemoryGame pairCount={2} />);
        await screen.findByTestId("arcade-memory-board");
        for (const id of [0, 1, 2, 3]) {
            fireEvent.click(screen.getByTestId(`arcade-memory-card-${id}`));
        }
        expect(screen.getByTestId("arcade-memory-won")).toHaveTextContent(
            "2 tries",
        );
    });

    it("a mismatch counts the try and keeps both cards visible", async () => {
        // Pin the shuffle so the pair order provably REVERSES (rand 0
        // swaps in the Fisher-Yates walk) - the assertions must not
        // depend on which input pair became pair 0 (caught by CI).
        const randSpy = vi.spyOn(Math, "random").mockReturnValue(0);
        try {
            mockContent([
                {front: "eins", back: "one"},
                {front: "zwei", back: "two"},
            ]);
            render(<MemoryGame pairCount={2} />);
            await screen.findByTestId("arcade-memory-board");
            // Card 0 (pair 0 front) + card 3 (pair 1 back) never match.
            fireEvent.click(screen.getByTestId("arcade-memory-card-0"));
            fireEvent.click(screen.getByTestId("arcade-memory-card-3"));
            expect(
                screen.getByTestId("arcade-memory-progress"),
            ).toHaveTextContent("Pairs: 0 / 2");
            expect(screen.getByTestId("arcade-memory-card-0")).toHaveAttribute(
                "aria-pressed",
                "true",
            );
            expect(screen.getByTestId("arcade-memory-card-3")).toHaveAttribute(
                "aria-pressed",
                "true",
            );
        } finally {
            randSpy.mockRestore();
        }
    });

    it("shows the empty state when no cached set exists", async () => {
        listSets.mockResolvedValue({
            sets: [
                {
                    source: "owner/repo",
                    id: "set-ghost",
                    title: "Not downloaded",
                    cached_version: null,
                },
            ],
        });
        render(<MemoryGame pairCount={4} />);
        expect(
            await screen.findByTestId("arcade-memory-empty"),
        ).toBeInTheDocument();
    });
});
