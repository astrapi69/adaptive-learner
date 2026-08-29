/**
 * Tests for LessonAnswersDetail (#1007 Phase 2): the collapsible
 * "View all answers" detail renders a row per exercise, a token diff for a
 * wrong text answer, the bare canonical for a no-text-answer miss, and
 * nothing when the run had no exercises.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import LessonAnswersDetail from "./LessonAnswersDetail";
import type {ExerciseBreakdownEntry} from "../../../lib/lesson/lesson-summary";

function entry(
    over: Partial<ExerciseBreakdownEntry> & {stepId: string},
): ExerciseBreakdownEntry {
    return {
        stepId: over.stepId,
        title: over.title ?? `Exercise ${over.stepId}`,
        exerciseType: over.exerciseType ?? "free_text",
        attempted: over.attempted ?? true,
        correct: over.correct ?? 1,
        total: over.total ?? 1,
        fullyCorrect: over.fullyCorrect ?? true,
        canonicalAnswer: over.canonicalAnswer ?? "",
        userAnswer: over.userAnswer ?? null,
        question: over.question ?? null,
    };
}

describe("LessonAnswersDetail", () => {
    it("renders nothing for an empty breakdown", () => {
        const {container} = render(<LessonAnswersDetail breakdown={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the view-all disclosure with the count + a row per exercise", () => {
        render(
            <LessonAnswersDetail
                breakdown={[entry({stepId: "s1"}), entry({stepId: "s2"})]}
            />,
        );
        const summary = screen.getByTestId("lesson-summary-view-all-answers");
        expect(summary).toHaveTextContent("2");
        expect(screen.getByTestId("lesson-summary-breakdown-s1")).toBeInTheDocument();
        expect(screen.getByTestId("lesson-summary-breakdown-s2")).toBeInTheDocument();
    });

    it("shows a token diff for a wrong text answer", () => {
        render(
            <LessonAnswersDetail
                breakdown={[
                    entry({
                        stepId: "s1",
                        attempted: true,
                        fullyCorrect: false,
                        correct: 0,
                        canonicalAnswer: "Haus",
                        userAnswer: "Maus",
                    }),
                ]}
            />,
        );
        expect(
            screen.getByTestId("lesson-summary-breakdown-diff-s1"),
        ).toBeInTheDocument();
    });

    it("shows the bare canonical answer for a miss with no text answer", () => {
        render(
            <LessonAnswersDetail
                breakdown={[
                    entry({
                        stepId: "s1",
                        attempted: true,
                        fullyCorrect: false,
                        correct: 0,
                        canonicalAnswer: "le chat",
                        userAnswer: null,
                    }),
                ]}
            />,
        );
        expect(
            screen.queryByTestId("lesson-summary-breakdown-diff-s1"),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("lesson-summary-breakdown-s1")).toHaveTextContent(
            "le chat",
        );
    });

    it("marks an unattempted exercise", () => {
        render(
            <LessonAnswersDetail
                breakdown={[entry({stepId: "s1", attempted: false})]}
            />,
        );
        expect(
            screen.getByTestId("lesson-summary-breakdown-s1"),
        ).toHaveAttribute("data-status", "unattempted");
    });

    it("a row is expandable and reveals the question plus both answers (#2807)", () => {
        render(
            <LessonAnswersDetail
                breakdown={[
                    entry({
                        stepId: "s1",
                        title: "Warum eine Wissenschaft",
                        correct: 2,
                        total: 3,
                        attempted: true,
                        fullyCorrect: false,
                        question: "Warum ist das eine Wissenschaft?",
                        userAnswer: "weil",
                        canonicalAnswer: "weil sie pruefbar ist",
                    }),
                ]}
            />,
        );
        // Collapsed the row stays compact: title + score only.
        expect(screen.getByTestId("lesson-summary-breakdown-s1")).toHaveTextContent(
            "Warum eine Wissenschaft",
        );
        // The question and the learner's own answer are present in the row's
        // disclosure body - the #2757 class ("answers without the question").
        expect(screen.getByTestId("lesson-summary-question-s1")).toHaveTextContent(
            "Warum ist das eine Wissenschaft?",
        );
        expect(screen.getByTestId("lesson-summary-your-answer-s1")).toHaveTextContent(
            "weil",
        );
    });

    it("a partially correct row without a text answer still reveals question + solution (#2807)", () => {
        render(
            <LessonAnswersDetail
                breakdown={[
                    entry({
                        stepId: "s2",
                        correct: 2,
                        total: 3,
                        attempted: true,
                        fullyCorrect: false,
                        question: "Ordne die Paare zu",
                        userAnswer: null,
                        canonicalAnswer: "A-1, B-2",
                    }),
                ]}
            />,
        );
        expect(screen.getByTestId("lesson-summary-question-s2")).toBeInTheDocument();
        expect(screen.getByTestId("lesson-summary-breakdown-s2")).toHaveTextContent(
            "A-1, B-2",
        );
        expect(screen.queryByTestId("lesson-summary-your-answer-s2")).toBeNull();
    });

    it("a fully correct row still shows its question - the section promises ALL answers (#2807)", () => {
        render(
            <LessonAnswersDetail
                breakdown={[
                    entry({
                        stepId: "s3",
                        correct: 3,
                        total: 3,
                        attempted: true,
                        fullyCorrect: true,
                        question: "Frage",
                    }),
                ]}
            />,
        );
        // "View all answers" means all of them: the question belongs to a
        // correct row too. Only the wrong-answer diff is absent here.
        expect(screen.getByTestId("lesson-summary-question-s3")).toHaveTextContent(
            "Frage",
        );
        expect(
            screen.queryByTestId("lesson-summary-breakdown-diff-s3"),
        ).toBeNull();
    });
});
