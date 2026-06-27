/**
 * Controlled (two-phase button) mode for every exercise type
 * (BUG P1 / Problem 1).
 *
 * When the Lesson page opts into ``controlled`` each exercise:
 *   - hides its own "Check" / "Try again" buttons,
 *   - reports answerable state via ``onInteraction`` so the
 *     parent can enable a single shared "Prüfen" button, and
 *   - exposes ``submit()`` through a ref so that one button
 *     drives evaluation (emitting ``raw_answer``).
 *
 * The default (uncontrolled) behaviour is pinned by each
 * exercise's own test file; here we pin only the controlled
 * contract that the Review + AdaptiveLesson pages deliberately
 * do NOT use.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {createRef} from "react";
import {describe, expect, it, vi} from "vitest";

import ClozeExercise from "./ClozeExercise";
import type {ExerciseHandle} from "../shell/exercise-control";
import FreeTextExercise from "./FreeTextExercise";
import MatchingExercise from "./MatchingExercise";
import PictureChoiceExercise from "./PictureChoiceExercise";
import WordTilesExercise from "./WordTilesExercise";
import type {ContentLessonExercise} from "../../../storage/types";

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

const PICTURE: ContentLessonExercise = {
    id: "ex-pic",
    type: "picture_choice",
    prompt: "Pick.",
    card_ids: [],
    images: [
        {src: "a.svg", label: "Apple", is_correct: "true"},
        {src: "b.svg", label: "Banana"},
    ],
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

describe("controlled mode: internal Check button is hidden", () => {
    it("matching hides its submit button when controlled", () => {
        render(
            <MatchingExercise
                exercise={MATCHING}
                controlled
                onComplete={vi.fn()}
            />,
        );
        expect(screen.queryByTestId("matching-submit")).toBeNull();
    });

    it("picture / free-text / word-tiles / cloze hide their submit buttons", () => {
        const {unmount: u1} = render(
            <PictureChoiceExercise
                exercise={PICTURE}
                controlled
                onComplete={vi.fn()}
            />,
        );
        expect(screen.queryByTestId("picture-submit")).toBeNull();
        u1();
        const {unmount: u2} = render(
            <FreeTextExercise
                exercise={FREE_TEXT}
                controlled
                onComplete={vi.fn()}
            />,
        );
        expect(screen.queryByTestId("free-text-submit")).toBeNull();
        u2();
        const {unmount: u3} = render(
            <WordTilesExercise
                exercise={WORD_TILES}
                controlled
                onComplete={vi.fn()}
            />,
        );
        expect(screen.queryByTestId("word-tiles-submit")).toBeNull();
        u3();
        render(
            <ClozeExercise
                exercise={CLOZE}
                controlled
                onComplete={vi.fn()}
            />,
        );
        expect(screen.queryByTestId("cloze-submit")).toBeNull();
    });
});

describe("controlled mode: interaction toggles answerable + submit grades", () => {
    it("matching: answerable flips true once every pair is made, submit emits raw_answer", () => {
        const onInteraction = vi.fn();
        const onComplete = vi.fn();
        const ref = createRef<ExerciseHandle>();
        render(
            <MatchingExercise
                ref={ref}
                exercise={MATCHING}
                controlled
                onInteraction={onInteraction}
                onComplete={onComplete}
            />,
        );
        // Reports the initial (not-yet-answerable) state on mount.
        expect(onInteraction).toHaveBeenCalledWith(false);
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        // One pair of two — still not answerable.
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        expect(onInteraction).toHaveBeenLastCalledWith(true);
        act(() => ref.current!.submit());
        expect(onComplete).toHaveBeenCalledTimes(1);
        const scored = onComplete.mock.calls[0][0];
        expect(scored).toMatchObject({correct: 2, total: 2});
        expect(scored.raw_answer).toEqual({
            kind: "matching",
            matches: [
                [0, 0],
                [1, 1],
            ],
        });
    });

    it("picture_choice: selecting an option enables, submit emits raw_answer", () => {
        const onInteraction = vi.fn();
        const onComplete = vi.fn();
        const ref = createRef<ExerciseHandle>();
        render(
            <PictureChoiceExercise
                ref={ref}
                exercise={PICTURE}
                controlled
                onInteraction={onInteraction}
                onComplete={onComplete}
            />,
        );
        expect(onInteraction).toHaveBeenCalledWith(false);
        fireEvent.click(screen.getByTestId("picture-choice-0"));
        expect(onInteraction).toHaveBeenLastCalledWith(true);
        act(() => ref.current!.submit());
        const scored = onComplete.mock.calls[0][0];
        expect(scored).toMatchObject({correct: 1, total: 1});
        expect(scored.raw_answer).toEqual({
            kind: "picture_choice",
            selected: 0,
        });
    });

    it("free_text: typing enables, submit emits raw_answer", () => {
        const onInteraction = vi.fn();
        const onComplete = vi.fn();
        const ref = createRef<ExerciseHandle>();
        render(
            <FreeTextExercise
                ref={ref}
                exercise={FREE_TEXT}
                controlled
                onInteraction={onInteraction}
                onComplete={onComplete}
            />,
        );
        expect(onInteraction).toHaveBeenCalledWith(false);
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "hola"},
        });
        expect(onInteraction).toHaveBeenLastCalledWith(true);
        act(() => ref.current!.submit());
        const scored = onComplete.mock.calls[0][0];
        expect(scored).toMatchObject({correct: 1, total: 1});
        expect(scored.raw_answer).toEqual({
            kind: "free_text",
            input: "hola",
        });
    });

    it("word_tiles: placing all tiles enables, submit emits raw_answer", () => {
        const onInteraction = vi.fn();
        const onComplete = vi.fn();
        const ref = createRef<ExerciseHandle>();
        render(
            <WordTilesExercise
                ref={ref}
                exercise={WORD_TILES}
                controlled
                onInteraction={onInteraction}
                onComplete={onComplete}
            />,
        );
        expect(onInteraction).toHaveBeenCalledWith(false);
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        expect(onInteraction).toHaveBeenLastCalledWith(true);
        act(() => ref.current!.submit());
        const scored = onComplete.mock.calls[0][0];
        expect(scored).toMatchObject({correct: 1, total: 1});
        expect(scored.raw_answer).toEqual({
            kind: "word_tiles",
            placed: [0, 1],
        });
    });

    it("cloze: filling every blank enables, submit emits raw_answer", () => {
        const onInteraction = vi.fn();
        const onComplete = vi.fn();
        const ref = createRef<ExerciseHandle>();
        render(
            <ClozeExercise
                ref={ref}
                exercise={CLOZE}
                controlled
                onInteraction={onInteraction}
                onComplete={onComplete}
            />,
        );
        expect(onInteraction).toHaveBeenCalledWith(false);
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "hablo"},
        });
        expect(onInteraction).toHaveBeenLastCalledWith(true);
        act(() => ref.current!.submit());
        const scored = onComplete.mock.calls[0][0];
        expect(scored).toMatchObject({correct: 1, total: 1});
        expect(scored.raw_answer).toEqual({
            kind: "cloze",
            inputs: ["hablo"],
        });
    });
});

describe("reviewed mode: locked post-check visual (Problem 2)", () => {
    it("matching reconstructs the result, no submit + no re-answer", () => {
        const onComplete = vi.fn();
        render(
            <MatchingExercise
                exercise={MATCHING}
                controlled
                reviewed={{
                    kind: "matching",
                    matches: [
                        [0, 0],
                        [1, 1],
                    ],
                }}
                onComplete={onComplete}
            />,
        );
        // Shows the graded result, not a fresh exercise.
        const result = screen.getByTestId("matching-result");
        expect(result).toHaveAttribute("data-result", "correct");
        expect(screen.queryByTestId("matching-submit")).toBeNull();
        // The right tiles are locked (cannot be re-answered).
        expect(screen.getByTestId("matching-right-0")).toBeDisabled();
    });

    it("picture_choice reconstructs the result", () => {
        render(
            <PictureChoiceExercise
                exercise={PICTURE}
                controlled
                reviewed={{kind: "picture_choice", selected: 0}}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("picture-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
        expect(screen.queryByTestId("picture-submit")).toBeNull();
        expect(screen.getByTestId("picture-choice-0")).toBeDisabled();
    });

    it("free_text reconstructs the answer + result, input locked", () => {
        render(
            <FreeTextExercise
                exercise={FREE_TEXT}
                controlled
                reviewed={{kind: "free_text", input: "hola"}}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("free-text-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
        const input = screen.getByTestId("free-text-input");
        expect(input).toHaveValue("hola");
        expect(input).toBeDisabled();
        expect(screen.queryByTestId("free-text-submit")).toBeNull();
    });

    it("word_tiles reconstructs the placed order + result", () => {
        render(
            <WordTilesExercise
                exercise={WORD_TILES}
                controlled
                reviewed={{kind: "word_tiles", placed: [0, 1]}}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("word-tiles-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
        expect(screen.queryByTestId("word-tiles-submit")).toBeNull();
        // #1005 — after check, the interactive placed tiles are replaced by
        // the read-only My-answer / Solution toggle views. The reviewed
        // [0, 1] order is correct, so its tiles render green.
        expect(screen.queryByTestId("word-tile-placed-0")).toBeNull();
        expect(
            screen.getByTestId("word-tiles-my-answer-view-tile-0"),
        ).toHaveAttribute("data-correct", "true");
    });

    it("cloze reconstructs the blanks + result, inputs locked", () => {
        render(
            <ClozeExercise
                exercise={CLOZE}
                controlled
                reviewed={{kind: "cloze", inputs: ["hablo"]}}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("cloze-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
        const input = screen.getByTestId("cloze-input-0");
        expect(input).toHaveValue("hablo");
        expect(input).toBeDisabled();
        expect(screen.queryByTestId("cloze-submit")).toBeNull();
    });
});
