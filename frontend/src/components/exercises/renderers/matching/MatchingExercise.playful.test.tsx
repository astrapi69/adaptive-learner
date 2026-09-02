/**
 * Playful card-snap for the matching renderer (#2876).
 *
 * Pins the presentation-only contract: in game mode freshly formed
 * pairs "snap" together (pop animation on both tiles) and correct
 * tiles hop at resolution, while testids, the pair lifecycle (tapping
 * a paired tile undoes it) and scoring stay identical to classic mode.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";

import MatchingExercise from "./MatchingExercise";
import {LessonModeProvider} from "../../../../hooks/lesson/modes/useLessonMode";
import {setPlayfulMode} from "../../../../lib/learning/playfulModePref";
import type {ContentLessonExercise} from "../../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-match-playful",
    type: "matching",
    prompt: "Match each French word with its English translation.",
    card_ids: [],
    pairs: [
        {left: "Bonjour", right: "Hello"},
        {left: "Merci", right: "Thank you"},
        {left: "Au revoir", right: "Goodbye"},
    ],
    distractors: [],
};

const inLesson = (ui: ReactElement) =>
    render(<LessonModeProvider mode="practice">{ui}</LessonModeProvider>);

const tap = (testid: string) => fireEvent.click(screen.getByTestId(testid));

const pairAll = () => {
    for (const i of [0, 1, 2]) {
        tap(`matching-left-${i}`);
        tap(`matching-right-${i}`);
    }
};

beforeEach(() => {
    localStorage.clear();
});

describe("MatchingExercise: playful card-snap (#2876)", () => {
    it("marks the root and snaps a formed pair in game mode", () => {
        setPlayfulMode(true);
        inLesson(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("matching-exercise")).toHaveAttribute(
            "data-playful",
            "true",
        );
        expect(
            screen.getByTestId("matching-left-0").className,
        ).not.toContain("lernfunke-pop");
        tap("matching-left-0");
        tap("matching-right-0");
        expect(screen.getByTestId("matching-left-0").className).toContain(
            "lernfunke-pop",
        );
        expect(screen.getByTestId("matching-right-0").className).toContain(
            "lernfunke-pop",
        );
    });

    it("keeps the classic look without game mode", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("matching-exercise")).not.toHaveAttribute(
            "data-playful",
        );
        tap("matching-left-0");
        tap("matching-right-0");
        expect(screen.getByTestId("matching-left-0").className).not.toContain(
            "lernfunke-pop",
        );
    });

    it("hops correct tiles at resolution in game mode", () => {
        setPlayfulMode(true);
        inLesson(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        pairAll();
        fireEvent.click(screen.getByTestId("matching-submit"));
        expect(screen.getByTestId("matching-left-0").className).toContain(
            "lernfunke-hop",
        );
    });

    it.each([
        ["classic", false],
        ["playful", true],
    ])(
        "behaviour parity (%s): undo works and scoring is identical",
        (_label, playful) => {
            if (playful) setPlayfulMode(true);
            const onComplete = vi.fn();
            const ui = (
                <MatchingExercise exercise={EXERCISE} onComplete={onComplete} />
            );
            if (playful) {
                inLesson(ui);
            } else {
                render(ui);
            }
            // Pair, undo by tapping the paired left, then re-pair all.
            tap("matching-left-0");
            tap("matching-right-1");
            tap("matching-left-0");
            pairAll();
            fireEvent.click(screen.getByTestId("matching-submit"));
            expect(onComplete).toHaveBeenCalledTimes(1);
            const scored = onComplete.mock.calls[0][0];
            expect(scored.correct).toBe(3);
            expect(scored.total).toBe(3);
        },
    );
});
