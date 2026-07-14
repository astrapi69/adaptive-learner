/**
 * Tests for the ext:al-error-correction renderer (#1579, second adoption).
 *
 * Pins the tap-token-then-type flow, the pick+text checkability gate, the
 * accept-array grading through the shared free-text matcher (any accepted
 * variant counts, #1580 normalization inherited), the per-token verdicts,
 * the canonical accept[0] solution line after a wrong attempt, retry, and
 * the reviewed (locked) reconstruction - display parity with the
 * categorization renderer.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ErrorCorrectionExercise from "./ErrorCorrectionExercise";
import type {ContentLessonExercise} from "../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-errcorr-01",
    type: "ext:al-error-correction",
    prompt: "Ein Wort ist falsch - tippe es an und korrigiere es.",
    card_ids: [],
    distractors: [],
    ext_payload: {
        tokens: ["Der", "Hund", "folgt", "das", "Kommando"],
        error_index: 3,
        accept: ["dem", "einem"],
    },
} as unknown as ContentLessonExercise;

const pickToken = (index: number) =>
    fireEvent.click(screen.getByTestId(`error-correction-token-${index}`));

const typeCorrection = (value: string) =>
    fireEvent.change(screen.getByTestId("error-correction-input"), {
        target: {value},
    });

const check = () => fireEvent.click(screen.getByTestId("error-correction-submit"));

describe("ErrorCorrectionExercise: render", () => {
    it("renders prompt, one button per token, and the correction input", () => {
        render(<ErrorCorrectionExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("error-correction-prompt")).toHaveTextContent(
            "Ein Wort ist falsch",
        );
        for (let tokenIndex = 0; tokenIndex < 5; tokenIndex++) {
            expect(
                screen.getByTestId(`error-correction-token-${tokenIndex}`),
            ).toBeInTheDocument();
        }
        expect(screen.getByTestId("error-correction-input")).toBeInTheDocument();
    });

    it("renders the empty state for a malformed payload", () => {
        const broken = {
            ...EXERCISE,
            ext_payload: {tokens: ["a", "b"]},
        } as unknown as ContentLessonExercise;
        render(<ErrorCorrectionExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("error-correction-empty")).toBeInTheDocument();
    });
});

describe("ErrorCorrectionExercise: checkability gate", () => {
    it("stays disabled until BOTH a token is picked and a correction is typed", () => {
        render(<ErrorCorrectionExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("error-correction-submit")).toBeDisabled();
        pickToken(3);
        expect(screen.getByTestId("error-correction-submit")).toBeDisabled();
        typeCorrection("dem");
        expect(screen.getByTestId("error-correction-submit")).toBeEnabled();
        typeCorrection("   ");
        expect(screen.getByTestId("error-correction-submit")).toBeDisabled();
    });
});

describe("ErrorCorrectionExercise: submit lifecycle", () => {
    it("grades right pick + canonical correction as correct with SRS attempt + raw_answer", () => {
        const onComplete = vi.fn();
        render(
            <ErrorCorrectionExercise
                exercise={EXERCISE}
                setId="set-1"
                lessonId="lesson-1"
                onComplete={onComplete}
            />,
        );
        pickToken(3);
        typeCorrection("dem");
        check();
        const scored = onComplete.mock.calls[0][0];
        expect(scored.correct).toBe(1);
        expect(scored.total).toBe(1);
        expect(scored.attempts).toHaveLength(1);
        expect(scored.attempts[0]).toMatchObject({
            element_key: "dem",
            element_type: "grammar_rule",
        });
        expect(scored.raw_answer).toEqual({
            kind: "al_error_correction",
            picked_index: 3,
            typed: "dem",
        });
        expect(screen.getByTestId("error-correction-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("accepts ANY accept entry through the shared free-text matcher", () => {
        const onComplete = vi.fn();
        render(<ErrorCorrectionExercise exercise={EXERCISE} onComplete={onComplete} />);
        pickToken(3);
        typeCorrection("  Einem "); // second entry, padded + case-folded (#1580 normalization)
        check();
        expect(onComplete.mock.calls[0][0].correct).toBe(1);
    });

    it("right pick + wrong correction is wrong and shows the canonical solution", () => {
        const onComplete = vi.fn();
        render(<ErrorCorrectionExercise exercise={EXERCISE} onComplete={onComplete} />);
        pickToken(3);
        typeCorrection("dieses");
        check();
        expect(onComplete.mock.calls[0][0].correct).toBe(0);
        expect(screen.getByTestId(`error-correction-token-3`)).toHaveAttribute(
            "data-verdict",
            "correct",
        );
        const solution = screen.getByTestId("error-correction-solution");
        expect(solution).toHaveTextContent("das");
        expect(solution).toHaveTextContent("dem");
    });

    it("wrong pick marks the picked token wrong and the real error as missed", () => {
        render(<ErrorCorrectionExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        pickToken(2);
        typeCorrection("dem");
        check();
        expect(screen.getByTestId("error-correction-token-2")).toHaveAttribute(
            "data-verdict",
            "wrong",
        );
        expect(screen.getByTestId("error-correction-token-3")).toHaveAttribute(
            "data-verdict",
            "missed",
        );
        expect(screen.getByTestId("error-correction-solution")).toBeInTheDocument();
    });

    it("retry clears pick, input, and verdicts", () => {
        render(<ErrorCorrectionExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        pickToken(2);
        typeCorrection("dem");
        check();
        fireEvent.click(screen.getByTestId("error-correction-retry"));
        expect(screen.getByTestId("error-correction-submit")).toBeDisabled();
        expect(screen.getByTestId("error-correction-input")).toHaveValue("");
        expect(
            screen.getByTestId("error-correction-token-2"),
        ).not.toHaveAttribute("data-verdict");
    });
});

describe("ErrorCorrectionExercise: reviewed (locked) reconstruction", () => {
    it("restores a wrong attempt with the same solution display as a fresh submit", () => {
        render(
            <ErrorCorrectionExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{
                    kind: "al_error_correction",
                    picked_index: 2,
                    typed: "dem",
                }}
            />,
        );
        expect(screen.getByTestId("error-correction-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
        expect(screen.getByTestId("error-correction-token-2")).toHaveAttribute(
            "data-verdict",
            "wrong",
        );
        expect(screen.getByTestId("error-correction-solution")).toBeInTheDocument();
        expect(screen.getByTestId("error-correction-input")).toHaveValue("dem");
        expect(
            screen.queryByTestId("error-correction-submit"),
        ).not.toBeInTheDocument();
    });

    it("restores a correct attempt without the solution line", () => {
        render(
            <ErrorCorrectionExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{
                    kind: "al_error_correction",
                    picked_index: 3,
                    typed: "einem",
                }}
            />,
        );
        expect(screen.getByTestId("error-correction-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
        expect(
            screen.queryByTestId("error-correction-solution"),
        ).not.toBeInTheDocument();
    });
});
