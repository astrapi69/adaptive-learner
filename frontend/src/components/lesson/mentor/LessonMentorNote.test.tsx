/**
 * LessonMentorNote (#2768) — the per-step note control the author sees
 * while playing an OWN lesson. Pins the gating (own sets only), the
 * save/prefill/remove round-trip against the real store, and the
 * empty-text guard.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it} from "vitest";

import LessonMentorNote from "./LessonMentorNote";
import {
    getMentorNote,
    storeMentorNote,
} from "../../../lib/lesson/mentor-notes-store";
import {USER_GENERATED_SOURCE} from "../../../storage/types";

const REF = {
    source: USER_GENERATED_SOURCE,
    setId: "my-set",
    filename: "01.json",
    stepId: "s-ex-1",
};

function renderControl(over: Partial<typeof REF> = {}) {
    const props = {...REF, ...over};
    return render(<LessonMentorNote {...props} />);
}

beforeEach(() => {
    localStorage.clear();
});

describe("LessonMentorNote (#2768)", () => {
    it.each([
        {label: "downloaded set", source: "astrapi69/learn-content", setId: "fr-a1"},
        {label: "analysis set", source: USER_GENERATED_SOURCE, setId: "analysis-x"},
    ])("renders nothing for a $label", ({source, setId}) => {
        renderControl({source, setId});
        expect(screen.queryByTestId("lesson-mentor-note")).not.toBeInTheDocument();
    });

    it("saves a note for the step (category + text) into the store", () => {
        renderControl();
        fireEvent.click(screen.getByTestId("lesson-mentor-note-toggle"));
        fireEvent.change(screen.getByTestId("lesson-mentor-note-category"), {
            target: {value: "unclear"},
        });
        fireEvent.change(screen.getByTestId("lesson-mentor-note-text"), {
            target: {value: "Frage doppeldeutig"},
        });
        fireEvent.click(screen.getByTestId("lesson-mentor-note-save"));

        const stored = getMentorNote(REF);
        expect(stored?.category).toBe("unclear");
        expect(stored?.text).toBe("Frage doppeldeutig");
    });

    it("save stays disabled while the text is empty", () => {
        renderControl();
        fireEvent.click(screen.getByTestId("lesson-mentor-note-toggle"));
        expect(screen.getByTestId("lesson-mentor-note-save")).toBeDisabled();
    });

    it("prefills an existing note and can remove it", () => {
        storeMentorNote(REF, {category: "too_hard", text: "zu viele Paare"});
        renderControl();
        fireEvent.click(screen.getByTestId("lesson-mentor-note-toggle"));
        expect(screen.getByTestId("lesson-mentor-note-text")).toHaveValue(
            "zu viele Paare",
        );
        expect(screen.getByTestId("lesson-mentor-note-category")).toHaveValue(
            "too_hard",
        );
        fireEvent.click(screen.getByTestId("lesson-mentor-note-remove"));
        expect(getMentorNote(REF)).toBeNull();
    });
});
