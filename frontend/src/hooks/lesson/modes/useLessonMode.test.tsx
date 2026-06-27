/**
 * Tests for the lesson-mode context (#1007): default practice without a
 * provider, exam inside a provider, plus the exam-mode aid-gating it drives
 * (hints hidden, the word-tiles solution toggle hidden).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import {LessonModeProvider, useLessonMode} from "./useLessonMode";
import {ExerciseHint} from "../../../components/exercises";
import {WordTilesExercise} from "../../../components/exercises";
import type {ContentLessonExercise} from "../../../storage/types";

function ModeProbe() {
    return (
        <span data-testid="probe">{useLessonMode().mode}</span>
    );
}

const HINTED: ContentLessonExercise = {
    id: "ex-hint",
    type: "word_tiles",
    prompt: "Arrange the tiles.",
    card_ids: [],
    tiles: ["Au", "revoir"],
    distractors: [],
    hint: "Two short words.",
};

describe("useLessonMode", () => {
    it("returns the practice config without a provider", () => {
        render(<ModeProbe />);
        expect(screen.getByTestId("probe")).toHaveTextContent("practice");
    });

    it("returns the active mode's config inside a provider", () => {
        render(
            <LessonModeProvider mode="exam">
                <ModeProbe />
            </LessonModeProvider>,
        );
        expect(screen.getByTestId("probe")).toHaveTextContent("exam");
    });
});

describe("exam-mode aid gating", () => {
    it("hides the hint button in exam mode but shows it in practice", () => {
        const {rerender} = render(
            <LessonModeProvider mode="practice">
                <ExerciseHint exercise={HINTED} submitted={false} />
            </LessonModeProvider>,
        );
        expect(screen.getByTestId("exercise-hint")).toBeInTheDocument();

        rerender(
            <LessonModeProvider mode="exam">
                <ExerciseHint exercise={HINTED} submitted={false} />
            </LessonModeProvider>,
        );
        expect(screen.queryByTestId("exercise-hint")).toBeNull();
    });

    it("hides the word-tiles My-answer / Solution toggle in exam mode", () => {
        render(
            <LessonModeProvider mode="exam">
                <WordTilesExercise exercise={HINTED} onComplete={() => {}} />
            </LessonModeProvider>,
        );
        // Answer (wrong order) and check.
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tiles-submit"));
        // No solution-reveal toggle in exam mode.
        expect(screen.queryByTestId("word-tiles-answer-toggle")).toBeNull();
        expect(screen.queryByTestId("word-tiles-solution-view")).toBeNull();
    });
});
