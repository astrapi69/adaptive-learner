/**
 * MentorNotesEditPanel (#2769) — the punch list inside the editor.
 * Pins gating (own set + notes), rows, per-note removal, and that a
 * suggestion result renders as the displayed proposal. The generic
 * AiSuggestButton is stubbed (its BYOK/spinner/empty affordances carry
 * their own tests); the stub invokes ``run`` with a fake provider and
 * hands the result to ``onResult`` — so the real ``suggestMentorFix``
 * wiring executes.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("./fields", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./fields")>();
    return {
        ...actual,
        AiSuggestButton: ({
            run,
            onResult,
            testId,
        }: {
            run: (provider: {
                complete: (prompt: string) => Promise<string>;
            }) => Promise<string>;
            onResult: (proposal: string) => void;
            testId: string;
        }) => (
            <button
                type="button"
                data-testid={`${testId}-button`}
                onClick={() => {
                    void run({
                        complete: async (prompt: string) =>
                            `PROPOSAL for: ${prompt.includes('"Translate merci"') ? "exercise" : "theory"}`,
                    }).then(onResult);
                }}
            >
                stub
            </button>
        ),
    };
});

import MentorNotesEditPanel from "./MentorNotesEditPanel";
import {
    getMentorNote,
    storeMentorNote,
} from "../../lib/lesson/mentor-notes-store";
import {USER_GENERATED_SOURCE} from "../../storage/types";
import type {ContentLessonExercise} from "../../storage/types";

const LESSON_REF = {
    source: USER_GENERATED_SOURCE,
    setId: "my-set",
    filename: "01.json",
};

const EXERCISES: ContentLessonExercise[] = [
    {
        id: "ex-1",
        type: "free_text",
        prompt: "Translate merci",
        card_ids: [],
        accept: ["thank you"],
        distractors: [],
    },
];

function renderPanel(over: Partial<typeof LESSON_REF> = {}) {
    return render(
        <MentorNotesEditPanel
            {...LESSON_REF}
            {...over}
            lessonTitle="Begrüßungen"
            exercises={EXERCISES}
        />,
    );
}

beforeEach(() => {
    localStorage.clear();
});

describe("MentorNotesEditPanel (#2769)", () => {
    it("renders nothing without notes and for non-own sets", () => {
        renderPanel();
        expect(screen.queryByTestId("mentor-edit-panel")).toBeNull();

        storeMentorNote(
            {...LESSON_REF, source: "astrapi69/learn-content", stepId: "s1"},
            {category: "typo", text: "x"},
        );
        renderPanel({source: "astrapi69/learn-content"});
        expect(screen.queryByTestId("mentor-edit-panel")).toBeNull();
    });

    it("lists the lesson's notes and removes one from the store", () => {
        storeMentorNote(
            {...LESSON_REF, stepId: "ex-1"},
            {category: "typo", text: "Umlaut fehlt"},
        );
        renderPanel();
        expect(screen.getByTestId("mentor-edit-note-ex-1")).toHaveTextContent(
            "Umlaut fehlt",
        );
        fireEvent.click(screen.getByTestId("mentor-edit-remove-ex-1"));
        expect(getMentorNote({...LESSON_REF, stepId: "ex-1"})).toBeNull();
        expect(screen.queryByTestId("mentor-edit-panel")).toBeNull();
    });

    it("renders the AI proposal for the note's exercise", async () => {
        storeMentorNote(
            {...LESSON_REF, stepId: "ex-1"},
            {category: "unclear", text: "Frage doppeldeutig"},
        );
        renderPanel();
        fireEvent.click(screen.getByTestId("mentor-edit-suggest-ex-1-button"));
        await waitFor(() =>
            expect(
                screen.getByTestId("mentor-edit-proposal-ex-1"),
            ).toHaveTextContent("PROPOSAL for: exercise"),
        );
    });

    it("suggests without exercise JSON for a theory-step note", async () => {
        storeMentorNote(
            {...LESSON_REF, stepId: "s-theory"},
            {category: "other", text: "Absatz umformulieren"},
        );
        renderPanel();
        fireEvent.click(
            screen.getByTestId("mentor-edit-suggest-s-theory-button"),
        );
        await waitFor(() =>
            expect(
                screen.getByTestId("mentor-edit-proposal-s-theory"),
            ).toHaveTextContent("PROPOSAL for: theory"),
        );
    });
});
