import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";

import SetDetail from "./SetDetail";
import type {
    PersonalPathLesson,
    PersonalPathSet,
} from "../../lib/learning-path/personal-path";

function lesson(n: number): PersonalPathLesson {
    return {
        source: "src",
        setId: "psych",
        filename: `0${n}.json`,
        number: n,
        title: `Lesson ${n}`,
        stars: 0,
        status: "not_started",
        dot: "not_started",
        receptive: "na",
        productive: "na",
        lastActivity: null,
        isCurrent: false,
    };
}

function setFixture(overrides: Partial<PersonalPathSet> = {}): PersonalPathSet {
    return {
        source: "src",
        setId: "psych",
        title: "Psychologie",
        titleNative: null,
        domain: "psychology",
        sourceLanguage: "de",
        targetLanguage: "de",
        level: "a1",
        lessons: [lesson(1), lesson(2), lesson(3)],
        completedCount: 0,
        totalCount: 3,
        percentComplete: 0,
        lastActivity: null,
        currentLesson: null,
        mode: "start",
        errorCount: 0,
        nextLevel: null,
        ...overrides,
    };
}

function renderDetail(set: PersonalPathSet) {
    return render(
        <MemoryRouter>
            <SetDetail set={set} />
        </MemoryRouter>,
    );
}

describe("SetDetail", () => {
    it("renders one LessonRow per lesson", () => {
        renderDetail(setFixture());
        expect(
            screen.getAllByTestId(/^lesson-row-psych-/),
        ).toHaveLength(3);
    });

    it("offers the gated set-wide train-errors action when errors exist (#1012)", () => {
        renderDetail(setFixture({errorCount: 7}));
        const link = screen.getByTestId("set-train-errors-psych");
        expect(link).toHaveAttribute("href", "/adaptive-lesson/psych");
        expect(link).toHaveTextContent("7");
    });

    it("hides the set-wide train-errors action when there are no errors (#1012)", () => {
        renderDetail(setFixture({errorCount: 0}));
        expect(screen.queryByTestId("set-train-errors-psych")).toBeNull();
    });

    it("shows a per-lesson train-errors action scoped via ?lesson= (#1012)", () => {
        const withErrors = lesson(1);
        withErrors.srs = {
            status: "due",
            total: 5,
            mastered: 2,
            due: 3,
            nextReviewAt: null,
        };
        renderDetail(setFixture({lessons: [withErrors, lesson(2), lesson(3)]}));
        const link = screen.getByTestId("lesson-train-errors-01.json");
        expect(link).toHaveAttribute(
            "href",
            "/adaptive-lesson/psych?lesson=01.json",
        );
        // total 5 - mastered 2 = 3 active error cards.
        expect(link).toHaveTextContent("3");
        // Lessons without SRS data render no per-lesson train-errors button.
        expect(screen.queryByTestId("lesson-train-errors-02.json")).toBeNull();
    });

    it("offers the set-level shuffle action when the set has >= 2 lessons (#1014)", () => {
        renderDetail(setFixture());
        expect(screen.getByTestId("set-shuffle-psych")).toHaveAttribute(
            "href",
            "/shuffle-lesson/psych",
        );
    });

    it("hides the shuffle action for a single-lesson set (#1014)", () => {
        renderDetail(setFixture({lessons: [lesson(1)], totalCount: 1}));
        expect(screen.queryByTestId("set-shuffle-psych")).toBeNull();
    });

    it("hides the error-replay action when there are no errors", () => {
        renderDetail(setFixture({errorCount: 0}));
        expect(screen.queryByTestId("set-error-replay-psych")).toBeNull();
    });

    it("shows the error-replay action with a count when errors exist", () => {
        renderDetail(setFixture({errorCount: 12}));
        const link = screen.getByTestId("set-error-replay-psych");
        expect(link).toHaveAttribute("href", "/review/psych");
        expect(link).toHaveTextContent("12");
    });

    it("marks both action links with data-slot=button (#779)", () => {
        // Button-styled router <a>s must carry data-slot="button" so the
        // global ``a:not([data-slot=button]){color:var(--accent)}`` rule
        // skips them; otherwise the solid action's label is accent-on-accent
        // (invisible) and the outline action's text loses --fg-primary.
        renderDetail(setFixture({errorCount: 3}));
        expect(screen.getByTestId("set-train-errors-psych")).toHaveAttribute(
            "data-slot",
            "button",
        );
        expect(screen.getByTestId("set-error-replay-psych")).toHaveAttribute(
            "data-slot",
            "button",
        );
    });
});
