/**
 * Success-merge: on a fully-correct answer the redundant
 * "My answer" / "Solution" toggle is replaced by a success badge +
 * a single "Continue" action that drives the lesson's forward
 * navigation (#1218).
 *
 * The merge is opt-in via ``onAdvance`` (the lesson passes ``goNext``),
 * so the Review / Adaptive runners — which pass no ``onAdvance`` — keep
 * the plain toggle. Gated on the mode's ``showAnswerToggle`` (off in
 * exam), so exam mode never shows it.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {createRef} from "react";
import {describe, expect, it, vi} from "vitest";

import ClozeExercise from "./ClozeExercise";
import FreeTextExercise from "./FreeTextExercise";
import MatchingExercise from "./MatchingExercise";
import WordTilesExercise from "./WordTilesExercise";
import type {ExerciseHandle} from "../shell/exercise-control";
import type {ContentLessonExercise} from "../../../storage/types";

const WORD_TILES: ContentLessonExercise = {
    id: "ex-tiles",
    type: "word_tiles",
    prompt: "Order.",
    card_ids: [],
    tiles: ["yo", "hablo"],
    distractors: [],
};

const CLOZE: ContentLessonExercise = {
    id: "ex-cloze",
    type: "cloze",
    prompt: "Fill.",
    card_ids: [],
    sentence: "Yo ___ español.",
    blanks: [{accept: ["hablo"]}],
    cloze_mode: "type",
    distractors: [],
};

const FREE_TEXT: ContentLessonExercise = {
    id: "ex-free",
    type: "free_text",
    prompt: "Translate hello.",
    card_ids: [],
    accept: ["hola"],
    distractors: [],
};

const MATCHING: ContentLessonExercise = {
    id: "ex-match",
    type: "matching",
    prompt: "Match.",
    card_ids: [],
    pairs: [
        {left: "A", right: "1"},
        {left: "B", right: "2"},
    ],
    distractors: [],
};

describe("success-merge: correct answer replaces the toggle (#1218)", () => {
    it("word_tiles: a correct answer shows the success-advance, not the toggle", () => {
        const ref = createRef<ExerciseHandle>();
        render(
            <WordTilesExercise
                ref={ref}
                exercise={WORD_TILES}
                controlled
                onAdvance={vi.fn()}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        act(() => ref.current!.submit());

        expect(
            screen.getByTestId("word-tiles-success-advance"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("word-tiles-advance")).toBeInTheDocument();
        // The two redundant toggle buttons are gone.
        expect(screen.queryByTestId("word-tiles-my-answer")).toBeNull();
        expect(screen.queryByTestId("word-tiles-solution")).toBeNull();
    });

    it("word_tiles: a WRONG answer keeps the toggle, no success-advance", () => {
        const ref = createRef<ExerciseHandle>();
        render(
            <WordTilesExercise
                ref={ref}
                exercise={WORD_TILES}
                controlled
                onAdvance={vi.fn()}
                onComplete={vi.fn()}
            />,
        );
        // Place tiles in the wrong order (hablo, yo).
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        act(() => ref.current!.submit());

        expect(screen.queryByTestId("word-tiles-success-advance")).toBeNull();
        expect(screen.getByTestId("word-tiles-my-answer")).toBeInTheDocument();
        expect(screen.getByTestId("word-tiles-solution")).toBeInTheDocument();
    });

    it("word_tiles: clicking Continue triggers the forward callback", () => {
        const onAdvance = vi.fn();
        const ref = createRef<ExerciseHandle>();
        render(
            <WordTilesExercise
                ref={ref}
                exercise={WORD_TILES}
                controlled
                onAdvance={onAdvance}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        act(() => ref.current!.submit());
        fireEvent.click(screen.getByTestId("word-tiles-advance"));
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it("word_tiles: WITHOUT onAdvance the toggle is kept (Review/Adaptive path)", () => {
        const ref = createRef<ExerciseHandle>();
        render(
            <WordTilesExercise
                ref={ref}
                exercise={WORD_TILES}
                controlled
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        act(() => ref.current!.submit());
        expect(screen.queryByTestId("word-tiles-success-advance")).toBeNull();
        expect(screen.getByTestId("word-tiles-my-answer")).toBeInTheDocument();
    });

    it("cloze: a correct answer shows the success-advance (cross-type)", () => {
        const ref = createRef<ExerciseHandle>();
        render(
            <ClozeExercise
                ref={ref}
                exercise={CLOZE}
                controlled
                onAdvance={vi.fn()}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "hablo"},
        });
        act(() => ref.current!.submit());
        expect(screen.getByTestId("cloze-success-advance")).toBeInTheDocument();
        expect(screen.getByTestId("cloze-advance")).toBeInTheDocument();
        expect(screen.queryByTestId("cloze-my-answer")).toBeNull();
        expect(screen.queryByTestId("cloze-solution")).toBeNull();
    });

    it("free_text: a correct answer shows the success-advance", () => {
        const ref = createRef<ExerciseHandle>();
        render(
            <FreeTextExercise
                ref={ref}
                exercise={FREE_TEXT}
                controlled
                onAdvance={vi.fn()}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "hola"},
        });
        act(() => ref.current!.submit());
        expect(
            screen.getByTestId("free-text-success-advance"),
        ).toBeInTheDocument();
    });

    it("matching: a correct answer shows the success-advance, not the view toggle", () => {
        const ref = createRef<ExerciseHandle>();
        render(
            <MatchingExercise
                ref={ref}
                exercise={MATCHING}
                controlled
                onAdvance={vi.fn()}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        act(() => ref.current!.submit());
        expect(
            screen.getByTestId("matching-success-advance"),
        ).toBeInTheDocument();
        expect(screen.queryByTestId("matching-view-toggle")).toBeNull();
    });
});
