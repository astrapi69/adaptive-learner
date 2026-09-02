/**
 * Playful word-jump for the select-mode cloze (#2876).
 *
 * Pins the presentation-only contract: in game mode a picked word
 * "jumps" into its blank (hop animation on the sentence chip) and the
 * root is marked, while testids, scoring and raw_answer stay identical
 * to the classic rendering.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";

import ClozeExercise from "./ClozeExercise";
import {LessonModeProvider} from "../../../../hooks/lesson/modes/useLessonMode";
import {setPlayfulMode} from "../../../../lib/learning/playfulModePref";
import type {ContentLessonExercise} from "../../../../storage/types";

const SELECT_MODE: ContentLessonExercise = {
    id: "ex-cloze-playful",
    type: "cloze",
    prompt: "Pick the right article.",
    card_ids: [],
    sentence: "Je vois ___ chat.",
    blanks: [{accept: ["un"]}],
    cloze_mode: "select",
    distractors: ["le", "la", "les"],
};

const inLesson = (ui: ReactElement) =>
    render(<LessonModeProvider mode="practice">{ui}</LessonModeProvider>);

const pick = (word: string) =>
    fireEvent.click(screen.getByRole("radio", {name: word}));

beforeEach(() => {
    localStorage.clear();
});

describe("ClozeExercise: playful word-jump (#2876)", () => {
    it("marks the root and hops the picked word into the blank in game mode", () => {
        setPlayfulMode(true);
        inLesson(<ClozeExercise exercise={SELECT_MODE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("cloze-exercise")).toHaveAttribute(
            "data-playful",
            "true",
        );
        expect(screen.getByTestId("cloze-selected-0").className).not.toContain(
            "lernfunke-hop",
        );
        pick("un");
        const chip = screen.getByTestId("cloze-selected-0");
        expect(chip).toHaveTextContent("un");
        expect(chip.className).toContain("lernfunke-hop");
    });

    it("keeps the classic chip without game mode", () => {
        render(<ClozeExercise exercise={SELECT_MODE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("cloze-exercise")).not.toHaveAttribute(
            "data-playful",
        );
        pick("un");
        expect(screen.getByTestId("cloze-selected-0").className).not.toContain(
            "lernfunke-hop",
        );
    });

    it.each([
        ["classic", false],
        ["playful", true],
    ])(
        "behaviour parity (%s): same testids and identical scoring",
        (_label, playful) => {
            if (playful) setPlayfulMode(true);
            const onComplete = vi.fn();
            const ui = (
                <ClozeExercise exercise={SELECT_MODE} onComplete={onComplete} />
            );
            if (playful) {
                inLesson(ui);
            } else {
                render(ui);
            }
            expect(screen.getByTestId("cloze-choices-0")).toBeInTheDocument();
            expect(screen.getByTestId("cloze-selected-0")).toBeInTheDocument();
            pick("un");
            fireEvent.click(screen.getByTestId("cloze-submit"));
            expect(onComplete).toHaveBeenCalledTimes(1);
            const scored = onComplete.mock.calls[0][0];
            expect(scored.correct).toBe(1);
            expect(scored.total).toBe(1);
        },
    );
});
