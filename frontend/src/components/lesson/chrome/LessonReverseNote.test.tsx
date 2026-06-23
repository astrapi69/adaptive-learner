/**
 * Tests for LessonReverseNote (#1013): the "(not reversible)" note shows
 * only in reverse mode on a non-matching exercise step, and is absent
 * otherwise (normal mode, theory step, matching step, summary screen).
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import LessonReverseNote from "./LessonReverseNote";
import type {
    ContentLessonExercise,
    ContentLessonStep,
} from "../../../storage/types";

function exerciseStep(
    type: ContentLessonExercise["type"],
): ContentLessonStep {
    return {
        id: `s-${type}`,
        type: "exercise",
        exercise: {
            id: `ex-${type}`,
            type,
            prompt: "Prompt",
            card_ids: ["c1"],
            distractors: [],
        },
    };
}

const NOTE = "lesson-reverse-not-reversible";

describe("LessonReverseNote", () => {
    it("shows the note in reverse mode on a non-matching exercise", () => {
        render(
            <LessonReverseNote
                reverseMode
                isExerciseStep
                step={exerciseStep("free_text")}
            />,
        );
        expect(screen.getByTestId(NOTE)).toBeInTheDocument();
    });

    it("hides the note for a matching exercise (it IS reversible)", () => {
        render(
            <LessonReverseNote
                reverseMode
                isExerciseStep
                step={exerciseStep("matching")}
            />,
        );
        expect(screen.queryByTestId(NOTE)).not.toBeInTheDocument();
    });

    it("hides the note when not in reverse mode", () => {
        render(
            <LessonReverseNote
                reverseMode={false}
                isExerciseStep
                step={exerciseStep("free_text")}
            />,
        );
        expect(screen.queryByTestId(NOTE)).not.toBeInTheDocument();
    });

    it("hides the note on the summary screen (null step)", () => {
        render(
            <LessonReverseNote reverseMode isExerciseStep step={null} />,
        );
        expect(screen.queryByTestId(NOTE)).not.toBeInTheDocument();
    });

    it("hides the note for a non-exercise (theory) step", () => {
        render(
            <LessonReverseNote
                reverseMode
                isExerciseStep={false}
                step={{id: "t1", type: "theory", body: "Body"}}
            />,
        );
        expect(screen.queryByTestId(NOTE)).not.toBeInTheDocument();
    });
});
