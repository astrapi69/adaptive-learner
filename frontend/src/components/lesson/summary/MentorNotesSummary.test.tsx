/**
 * MentorNotesSummary (#2768) — the author's punch list on the lesson
 * summary. Pins the self-gating (own set + notes present), the row
 * content, the Phase-1 editor deep link, and per-row removal.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {beforeEach, describe, expect, it} from "vitest";

import MentorNotesSummary from "./MentorNotesSummary";
import {
    getMentorNote,
    storeMentorNote,
} from "../../../lib/lesson/mentor-notes-store";
import {USER_GENERATED_SOURCE} from "../../../storage/types";

const LESSON_REF = {
    source: USER_GENERATED_SOURCE,
    setId: "my-set",
    filename: "01.json",
};

function renderSummaryBlock(over: Partial<typeof LESSON_REF> = {}) {
    return render(
        <MemoryRouter>
            <MentorNotesSummary {...LESSON_REF} {...over} />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    localStorage.clear();
});

describe("MentorNotesSummary (#2768)", () => {
    it("renders nothing without notes", () => {
        renderSummaryBlock();
        expect(
            screen.queryByTestId("lesson-mentor-summary"),
        ).not.toBeInTheDocument();
    });

    it("renders nothing for a non-own set even with a stray note", () => {
        storeMentorNote(
            {...LESSON_REF, source: "astrapi69/learn-content", stepId: "s1"},
            {category: "typo", text: "x"},
        );
        renderSummaryBlock({source: "astrapi69/learn-content"});
        expect(
            screen.queryByTestId("lesson-mentor-summary"),
        ).not.toBeInTheDocument();
    });

    it("lists the lesson's notes with the editor deep link", () => {
        storeMentorNote(
            {...LESSON_REF, stepId: "s-ex-1"},
            {category: "typo", text: "Umlaut fehlt"},
        );
        storeMentorNote(
            {...LESSON_REF, stepId: "s-ex-2"},
            {category: "too_easy", text: "Distraktoren zu offensichtlich"},
        );
        renderSummaryBlock();
        const block = screen.getByTestId("lesson-mentor-summary");
        expect(block).toHaveTextContent("Umlaut fehlt");
        expect(block).toHaveTextContent("Distraktoren zu offensichtlich");
        expect(screen.getByTestId("lesson-edit-in-editor")).toHaveAttribute(
            "href",
            "/create-lesson/edit/user-generated/my-set?lesson=01.json",
        );
    });

    it("removes a single note from the list and the store", () => {
        storeMentorNote(
            {...LESSON_REF, stepId: "s-ex-1"},
            {category: "typo", text: "weg damit"},
        );
        renderSummaryBlock();
        fireEvent.click(
            screen.getByTestId("lesson-mentor-summary-remove-s-ex-1"),
        );
        expect(
            getMentorNote({...LESSON_REF, stepId: "s-ex-1"}),
        ).toBeNull();
        // Last note removed -> the whole block self-hides.
        expect(
            screen.queryByTestId("lesson-mentor-summary"),
        ).not.toBeInTheDocument();
    });
});
