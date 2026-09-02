/**
 * Playful tile variant of the multiple_choice renderer (#2876).
 *
 * Pins the presentation-only contract: in game mode the options render
 * as large tappable tiles (grid layout, answer physics on the verdicts)
 * while every testid, the scoring and the raw_answer stay identical to
 * the classic list - behaviour parity is parametrized over both modes.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";

import MultipleChoiceExercise from "./MultipleChoiceExercise";
import {LessonModeProvider} from "../../../../hooks/lesson/modes/useLessonMode";
import {setPlayfulMode} from "../../../../lib/learning/playfulModePref";
import type {ContentLessonExercise} from "../../../../storage/types";

const SINGLE: ContentLessonExercise = {
    id: "ex-mc-playful",
    type: "multiple_choice",
    prompt: "Wie sagt man 'Hallo' auf Franzoesisch?",
    card_ids: [],
    distractors: [],
    options: [
        {text: "Bonjour", correct: true},
        {text: "Merci"},
        {text: "Au revoir"},
    ],
};

const inLesson = (ui: ReactElement) =>
    render(<LessonModeProvider mode="practice">{ui}</LessonModeProvider>);

const input = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

const check = () =>
    fireEvent.click(screen.getByTestId("multiple-choice-submit"));

beforeEach(() => {
    localStorage.clear();
});

describe("MultipleChoiceExercise: playful tiles (#2876)", () => {
    it("marks the root and lays the options out as a tile grid in game mode", () => {
        setPlayfulMode(true);
        inLesson(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("multiple-choice-exercise")).toHaveAttribute(
            "data-playful",
            "true",
        );
        expect(
            screen.getByTestId("multiple-choice-options").className,
        ).toContain("sm:grid-cols-2");
    });

    it("keeps the classic list without game mode (no provider, no flag)", () => {
        render(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        expect(
            screen.getByTestId("multiple-choice-exercise"),
        ).not.toHaveAttribute("data-playful");
        expect(
            screen.getByTestId("multiple-choice-options").className,
        ).toContain("flex-col");
    });

    it("keeps the classic list when the provider is present but game mode is off", () => {
        inLesson(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        expect(
            screen.getByTestId("multiple-choice-exercise"),
        ).not.toHaveAttribute("data-playful");
        expect(
            screen.getByTestId("multiple-choice-options").className,
        ).toContain("flex-col");
    });

    it("plays the answer physics on the chosen tile's verdict in game mode only", () => {
        setPlayfulMode(true);
        inLesson(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        fireEvent.click(input("Merci"));
        check();
        const wrongTile = screen
            .getByTestId("multiple-choice-options")
            .querySelector('[data-verdict="wrong"]') as HTMLElement;
        expect(wrongTile.className).toContain("matching-shake");
        const missedTile = screen
            .getByTestId("multiple-choice-options")
            .querySelector('[data-verdict="missed"]') as HTMLElement;
        expect(missedTile.className).not.toContain("matching-shake");
    });

    it("hops the correctly chosen tile in game mode", () => {
        setPlayfulMode(true);
        inLesson(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        fireEvent.click(input("Bonjour"));
        check();
        const correctTile = screen
            .getByTestId("multiple-choice-options")
            .querySelector('[data-verdict="correct"]') as HTMLElement;
        expect(correctTile.className).toContain("lernfunke-hop");
    });

    it("classic mode carries no answer-physics classes on the verdicts", () => {
        render(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        fireEvent.click(input("Merci"));
        check();
        const wrongTile = screen
            .getByTestId("multiple-choice-options")
            .querySelector('[data-verdict="wrong"]') as HTMLElement;
        expect(wrongTile.className).not.toContain("matching-shake");
    });

    it.each([
        ["classic", false],
        ["playful", true],
    ])(
        "behaviour parity (%s): same testids, same score, same raw_answer",
        (_label, playful) => {
            if (playful) setPlayfulMode(true);
            const onComplete = vi.fn();
            const ui = (
                <MultipleChoiceExercise
                    exercise={SINGLE}
                    onComplete={onComplete}
                />
            );
            if (playful) {
                inLesson(ui);
            } else {
                render(ui);
            }
            for (const idx of [0, 1, 2]) {
                expect(
                    screen.getByTestId(`multiple-choice-option-${idx}`),
                ).toBeInTheDocument();
                expect(
                    screen.getByTestId(`multiple-choice-input-${idx}`),
                ).toBeInTheDocument();
            }
            fireEvent.click(input("Bonjour"));
            check();
            expect(onComplete).toHaveBeenCalledTimes(1);
            const scored = onComplete.mock.calls[0][0];
            expect(scored.correct).toBe(1);
            expect(scored.total).toBe(1);
            expect(scored.raw_answer).toEqual({
                kind: "multiple_choice",
                selected: ["Bonjour"],
            });
            expect(
                screen.getByTestId("multiple-choice-result"),
            ).toHaveAttribute("data-result", "correct");
        },
    );
});
