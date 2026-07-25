import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router";

import LessonRow from "./LessonRow";
import type {PersonalPathLesson} from "../../lib/learning-path/personal-path";

function lesson(
    overrides: Partial<PersonalPathLesson> = {},
): PersonalPathLesson {
    return {
        source: "src",
        setId: "psych",
        filename: "03.json",
        number: 3,
        title: "Gedächtnis",
        stars: 2,
        status: "completed",
        dot: "done",
        receptive: "mastered",
        productive: "in_progress",
        lastActivity: "2026-06-01T10:00:00Z",
        isCurrent: false,
        ...overrides,
    };
}

function renderRow(l: PersonalPathLesson) {
    return render(
        <MemoryRouter>
            <LessonRow lesson={l} />
        </MemoryRouter>,
    );
}

describe("LessonRow", () => {
    it("links to the lesson viewer with a zero-padded number", () => {
        renderRow(lesson());
        const row = screen.getByTestId("lesson-row-psych-03.json");
        expect(row).toHaveAttribute("href", "/lesson/src/psych/03.json");
        expect(row).toHaveTextContent("03");
        expect(row).toHaveTextContent("Gedächtnis");
    });

    it("shows stars and per-direction mastery when attempted", () => {
        renderRow(lesson());
        expect(screen.getByTestId("lesson-row-stars")).toHaveAttribute(
            "aria-label",
            "2/3",
        );
        const dots = screen
            .getByTestId("lesson-row-psych-03.json")
            .querySelectorAll("[data-mastery]");
        expect(dots).toHaveLength(2);
        expect(dots[0].getAttribute("data-mastery")).toBe("mastered");
        expect(dots[1].getAttribute("data-mastery")).toBe("in_progress");
    });

    it("shows an em-dash and no mastery for a not-started lesson", () => {
        renderRow(
            lesson({
                status: "not_started",
                stars: 0,
                receptive: "na",
                productive: "na",
                lastActivity: null,
            }),
        );
        expect(screen.getByTestId("lesson-row-nostars")).toBeInTheDocument();
        expect(
            screen
                .getByTestId("lesson-row-psych-03.json")
                .querySelectorAll("[data-mastery]"),
        ).toHaveLength(0);
    });

    it("marks the current lesson", () => {
        renderRow(lesson({isCurrent: true}));
        expect(screen.getByTestId("lesson-row-psych-03.json")).toHaveAttribute(
            "data-current",
            "true",
        );
    });
});
