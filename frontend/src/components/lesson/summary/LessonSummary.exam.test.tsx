/**
 * LessonSummary exam pass/fail tests (#1007).
 *
 * In exam mode the summary adds a Passed / Not-passed line against the
 * configured threshold (default 60%). Practice mode shows no such line.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";

import LessonSummary from "./LessonSummary";
import type {ContentLesson, LessonProgress} from "../../../storage/types";

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

function renderSummary(mode: "practice" | "exam", correct: number, total: number) {
    return render(
        <MemoryRouter>
            <LessonSummary
                lesson={LESSON}
                progress={makeProgress(correct, total)}
                lessonMode={mode}
                nextLessonFilename={null}
                userId=""
                setId="set1"
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
