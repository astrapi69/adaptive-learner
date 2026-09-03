/**
 * Tests for the SimonGame component (#2907): tick-driven playback
 * into the input phase, the win at the target length, the friendly
 * loss + restart, and the pad tones routed through the sound
 * infrastructure. The reducer itself is pinned by
 * ``lib/arcade/simon.test.ts``.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import SimonGame from "./SimonGame";
import {playSound} from "../../lib/audio/sound-effects";

vi.mock("../../lib/audio/sound-effects", () => ({
    playSound: vi.fn(() => false),
}));

beforeEach(() => {
    vi.useFakeTimers();
    // Every rand-driven pad becomes pad 0, so the sequence is known.
    vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.mocked(playSound).mockClear();
});

/** One playback tick (lit or gap). */
function tick() {
    act(() => {
        vi.advanceTimersByTime(420);
    });
}

describe("SimonGame", () => {
    it("plays the sequence back, then the right pad wins at the target", () => {
        render(<SimonGame target={1} />);
        expect(screen.getByTestId("arcade-simon-status")).toHaveTextContent(
            "Watch the sequence",
        );
        expect(screen.getByTestId("arcade-simon-pad-0")).toBeDisabled();

        tick();
        expect(screen.getByTestId("arcade-simon-pad-0")).toHaveAttribute(
            "data-lit",
            "true",
        );
        tick();
        expect(screen.getByTestId("arcade-simon-status")).toHaveTextContent(
            "Your turn",
        );

        fireEvent.click(screen.getByTestId("arcade-simon-pad-0"));
        expect(screen.getByTestId("arcade-simon-status")).toHaveTextContent(
            "You did it",
        );
    });

    it("a wrong pad ends friendly with the reached length, restart resets", () => {
        render(<SimonGame target={1} />);
        tick();
        tick();
        fireEvent.click(screen.getByTestId("arcade-simon-pad-1"));
        expect(screen.getByTestId("arcade-simon-status")).toHaveTextContent(
            "you reached length 0",
        );

        fireEvent.click(screen.getByTestId("arcade-simon-restart"));
        expect(screen.getByTestId("arcade-simon-status")).toHaveTextContent(
            "Watch the sequence",
        );
        expect(screen.getByTestId("arcade-simon-pad-0")).toBeDisabled();
    });

    it("a completed round grows the sequence and replays it", () => {
        render(<SimonGame target={2} />);
        tick();
        tick();
        fireEvent.click(screen.getByTestId("arcade-simon-pad-0"));
        expect(screen.getByTestId("arcade-simon-status")).toHaveTextContent(
            "Watch the sequence",
        );
        expect(screen.getByTestId("arcade-simon-round")).toHaveTextContent(
            "Sequence 2 of 2",
        );
    });

    it("routes the pad tones through the sound infrastructure", () => {
        render(<SimonGame target={1} />);
        tick();
        expect(playSound).toHaveBeenCalledWith("simon_1");
        tick();
        vi.mocked(playSound).mockClear();
        fireEvent.click(screen.getByTestId("arcade-simon-pad-3"));
        expect(playSound).toHaveBeenCalledWith("simon_4");
    });
});
