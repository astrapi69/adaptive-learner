/**
 * LessonSummary exam pass/fail tests (#1007).
 *
 * In exam mode the summary adds a Passed / Not-passed line against the
 * configured threshold (default 60%). Practice mode shows no such line.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {afterEach, describe, expect, it, vi} from "vitest";

import LessonSummary from "./LessonSummary";
import type {ContentLesson, LessonProgress} from "../../../storage/types";
import type {SetEvaluation} from "../../../lib/lesson/summary/author-evaluation";

const LESSON: ContentLesson = {
    id: "l1",
    title: "Greetings",
    estimated_minutes: 5,
    cards: [],
    steps: [],
};

function makeProgress(correct: number, total: number): LessonProgress {
    return {
        id: "p1",
        user_id: "",
        source: "bundled:x",
        set_id: "set1",
        lesson_filename: "01.json",
        status: "completed",
        step_results: {},
        score_correct: correct,
        score_total: total,
        time_spent_seconds: 60,
        started_at: "2026-06-14T10:00:00Z",
        updated_at: "2026-06-14T10:01:00Z",
        completed_at: "2026-06-14T10:01:00Z",
        paused_at: null,
        abandoned_at: null,
    } as unknown as LessonProgress;
}

function renderSummary(
    mode: "practice" | "exam",
    correct: number,
    total: number,
    setEvaluation: SetEvaluation | null = null,
) {
    return render(
        <MemoryRouter>
            <LessonSummary
                lesson={LESSON}
                progress={makeProgress(correct, total)}
                lessonMode={mode}
                nextLessonFilename={null}
                userId=""
                setId="set1"
                setTitle="Set One"
                setEvaluation={setEvaluation}
                source="bundled:x"
                setSlug="x"
                lessonFilename="01.json"
                onMarkComplete={vi.fn()}
                onNextLesson={vi.fn()}
                onRepeat={vi.fn()}
                onExit={vi.fn()}
            />
        </MemoryRouter>,
    );
}

afterEach(() => {
    localStorage.clear();
});

describe("LessonSummary exam result", () => {
    it("shows no exam result panel in practice mode", () => {
        renderSummary("practice", 5, 10);
        expect(screen.queryByTestId("lesson-exam-result")).toBeNull();
    });

    it("marks a passing run (>= 60%) as passed in exam mode (#1007 Phase 2)", () => {
        renderSummary("exam", 8, 10);
        // The dedicated exam result panel (replaces the old inline line).
        const panel = screen.getByTestId("lesson-exam-result");
        expect(panel).toHaveAttribute("data-passed", "true");
        expect(screen.getByTestId("lesson-exam-result-retry")).toBeInTheDocument();
    });

    it("marks a failing run (< 60%) as not passed in exam mode", () => {
        renderSummary("exam", 5, 10);
        expect(screen.getByTestId("lesson-exam-result")).toHaveAttribute(
            "data-passed",
            "false",
        );
    });
});

describe("LessonSummary with the set's evaluation block (#3736)", () => {
    const PILOT: SetEvaluation = {scheme: "pass_fail", pass_percent: 60, title: "Hauptstadt-Prüfung"};

    function learnerThreshold(pct: number) {
        localStorage.setItem("adaptive-learner.lesson.exam_pass_threshold", String(pct));
    }

    it("pilot: 7 of 10 passes on the author's 60% although the learner asks 80%", () => {
        learnerThreshold(80);
        renderSummary("exam", 7, 10, PILOT);
        const panel = screen.getByTestId("lesson-exam-result");
        expect(panel).toHaveAttribute("data-passed", "true");
        expect(panel).toHaveAttribute("data-evaluation-source", "author");
        expect(panel).toHaveTextContent("Hauptstadt-Prüfung");
        expect(screen.getByTestId("lesson-exam-result-source")).toBeInTheDocument();
    });

    it("control: 7 of 10 without a block fails the learner's 80% as today", () => {
        learnerThreshold(80);
        renderSummary("exam", 7, 10, null);
        const panel = screen.getByTestId("lesson-exam-result");
        expect(panel).toHaveAttribute("data-passed", "false");
        expect(panel).toHaveAttribute("data-evaluation-source", "learner");
        expect(screen.queryByTestId("lesson-exam-result-source")).toBeNull();
    });

    it("practice mode ignores the block: no exam panel, compact view", () => {
        renderSummary("practice", 7, 10, {...PILOT, report: "detailed"});
        expect(screen.queryByTestId("lesson-exam-result")).toBeNull();
        expect(screen.getByTestId("lesson-summary")).toHaveAttribute("data-detailed", "false");
    });

    it("report: detailed opens the detailed evaluation in exam mode, and the toggle still closes it", () => {
        renderSummary("exam", 7, 10, {...PILOT, report: "detailed"});
        const root = screen.getByTestId("lesson-summary");
        expect(root).toHaveAttribute("data-detailed", "true");
        fireEvent.click(screen.getByTestId("lesson-summary-detailed-toggle"));
        expect(root).toHaveAttribute("data-detailed", "false");
    });

    it("report: compact keeps today's compact default", () => {
        renderSummary("exam", 7, 10, {...PILOT, report: "compact"});
        expect(screen.getByTestId("lesson-summary")).toHaveAttribute("data-detailed", "false");
    });
});

describe("LessonSummary star scale under the author's evaluation (#3740)", () => {
    const PILOT: SetEvaluation = {scheme: "pass_fail", pass_percent: 60, title: "Hauptstadt-Prüfung"};
    const GRADES: SetEvaluation = {
        scheme: "grades",
        grades: [
            {min_percent: 0, label: "F"},
            {min_percent: 60, label: "C"},
        ],
    };

    function expectStarScale(shown: boolean) {
        if (shown) {
            expect(screen.getByTestId("lesson-summary-stars")).toBeInTheDocument();
            expect(screen.getByTestId("lesson-summary-message")).toBeInTheDocument();
        } else {
            expect(screen.queryByTestId("lesson-summary-stars")).toBeNull();
            expect(screen.queryByTestId("lesson-summary-message")).toBeNull();
        }
    }

    it("pilot in exam mode: no star row, no star message, the exam card unchanged", () => {
        localStorage.setItem("adaptive-learner.lesson.exam_pass_threshold", "80");
        renderSummary("exam", 7, 10, PILOT);
        expectStarScale(false);
        const panel = screen.getByTestId("lesson-exam-result");
        expect(panel).toHaveAttribute("data-passed", "true");
        expect(panel).toHaveTextContent("Hauptstadt-Prüfung");
        expect(screen.getByTestId("lesson-exam-result-source")).toBeInTheDocument();
    });

    it.each([
        ["grades", GRADES],
        ["percent", {scheme: "percent", pass_percent: 70} as SetEvaluation],
    ])("%s scheme in exam mode: no star scale either", (_name, block) => {
        renderSummary("exam", 7, 10, block);
        expectStarScale(false);
    });

    it("exam mode without a block keeps the stars and the message", () => {
        renderSummary("exam", 7, 10, null);
        expectStarScale(true);
    });

    it("practice mode with a block keeps the stars and the message", () => {
        renderSummary("practice", 7, 10, PILOT);
        expectStarScale(true);
    });

    it("keeps the score bar under the author's evaluation", () => {
        renderSummary("exam", 7, 10, PILOT);
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
    });
});
