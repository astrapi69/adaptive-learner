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

    it("always offers an adaptive-lesson action", () => {
        renderDetail(setFixture());
        expect(screen.getByTestId("set-adaptive-psych")).toHaveAttribute(
            "href",
            "/adaptive-lesson/psych",
        );
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
        expect(screen.getByTestId("set-adaptive-psych")).toHaveAttribute(
            "data-slot",
            "button",
        );
        expect(screen.getByTestId("set-error-replay-psych")).toHaveAttribute(
            "data-slot",
            "button",
        );
    });
});
