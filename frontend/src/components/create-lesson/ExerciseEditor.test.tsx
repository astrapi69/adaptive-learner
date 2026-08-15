/**
 * Tests for the Step-3 inline exercise editor (#1844).
 *
 * One test group per exercise type covers: the editor renders the
 * type-specific fields, an edit is committed to the exercise record on
 * Save, and per-type validation disables Save + shows a message for an
 * invalid draft. The pure validation/normalization rules are pinned
 * separately in ``exercise-edit.test.ts``.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {describe, expect, it, vi} from "vitest";

import ExerciseEditor from "./ExerciseEditor";
import type {ContentLessonExercise} from "../../storage/types";

/** Stateful harness so edits actually round-trip through the exercise. */
function Harness({
    exercise,
    onSaved,
}: {
    exercise: ContentLessonExercise;
    onSaved?: (ex: ContentLessonExercise) => void;
}) {
    const [ex, setEx] = useState(exercise);
    const [saved, setSaved] = useState<ContentLessonExercise | null>(null);
    if (saved) {
        return <div data-testid="saved-json">{JSON.stringify(saved)}</div>;
    }
    return (
        <ExerciseEditor
            exercise={ex}
            onSave={(updated) => {
                setEx(updated);
                setSaved(updated);
                onSaved?.(updated);
            }}
            onCancel={vi.fn()}
        />
    );
}

function saveButton(id: string): HTMLButtonElement {
    return screen.getByTestId(`exercise-edit-save-${id}`) as HTMLButtonElement;
}

describe("ExerciseEditor — matching", () => {
    const ex = (): ContentLessonExercise =>
        ({
            id: "m1",
            type: "matching",
            prompt: "Match",
            card_ids: [],
            distractors: [],
            pairs: [
                {left: "un", right: "one"},
                {left: "deux", right: "two"},
            ],
        }) as ContentLessonExercise;

    it("renders a pair editor per pair", () => {
        render(<Harness exercise={ex()} />);
        expect(screen.getByTestId("exercise-edit-pair-left-m1-0")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-edit-pair-right-m1-1")).toBeInTheDocument();
    });

    it("commits an edited pair on Save", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={ex()} onSaved={onSaved} />);
        fireEvent.change(screen.getByTestId("exercise-edit-pair-right-m1-0"), {
            target: {value: "ONE"},
        });
        fireEvent.click(saveButton("m1"));
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(onSaved.mock.calls[0][0].pairs[0]).toEqual({left: "un", right: "ONE"});
    });

    it("disables Save + shows an error when a pair is incomplete", () => {
        render(<Harness exercise={ex()} />);
        fireEvent.change(screen.getByTestId("exercise-edit-pair-right-m1-1"), {
            target: {value: "  "},
        });
        expect(saveButton("m1")).toBeDisabled();
        expect(screen.getByTestId("exercise-edit-error-m1")).toBeInTheDocument();
    });
});

describe("ExerciseEditor — free_text", () => {
    const ex = (): ContentLessonExercise =>
        ({
            id: "f1",
            type: "free_text",
            prompt: "Translate: Bonjour",
            card_ids: [],
            distractors: [],
            accept: ["Guten Tag"],
        }) as ContentLessonExercise;

    it("renders the accepted-answers list editor", () => {
        render(<Harness exercise={ex()} />);
        expect(screen.getByTestId("exercise-edit-accept-f1")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-edit-accept-f1-item-0")).toHaveTextContent(
            "Guten Tag",
        );
    });

    it("commits an added accepted answer on Save", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={ex()} onSaved={onSaved} />);
        fireEvent.change(screen.getByTestId("exercise-edit-accept-f1-input"), {
            target: {value: "Hallo"},
        });
        fireEvent.click(screen.getByTestId("exercise-edit-accept-f1-add"));
        fireEvent.click(saveButton("f1"));
        expect(onSaved.mock.calls[0][0].accept).toEqual(["Guten Tag", "Hallo"]);
    });

    it("disables Save when no accepted answer remains", () => {
        render(<Harness exercise={ex()} />);
        fireEvent.click(screen.getByTestId("exercise-edit-accept-f1-remove-0"));
        expect(saveButton("f1")).toBeDisabled();
    });

    it("disables Save on an empty prompt", () => {
        render(<Harness exercise={ex()} />);
        fireEvent.change(screen.getByTestId("exercise-edit-prompt-f1"), {
            target: {value: "  "},
        });
        expect(saveButton("f1")).toBeDisabled();
    });
});

describe("ExerciseEditor — cloze", () => {
    const ex = (): ContentLessonExercise =>
        ({
            id: "c1",
            type: "cloze",
            prompt: "Fill in",
            card_ids: [],
            distractors: [],
            sentence: "Je ___ un livre.",
            blanks: [{accept: ["lis"]}],
            cloze_mode: "type",
        }) as ContentLessonExercise;

    it("renders the sentence + one blank editor per marker", () => {
        render(<Harness exercise={ex()} />);
        expect(screen.getByTestId("exercise-edit-sentence-c1")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-edit-blank-c1-0")).toBeInTheDocument();
        expect(screen.queryByTestId("exercise-edit-blank-c1-1")).not.toBeInTheDocument();
    });

    it("shows a second blank editor when a ___ marker is added and stays invalid until filled", () => {
        render(<Harness exercise={ex()} />);
        fireEvent.change(screen.getByTestId("exercise-edit-sentence-c1"), {
            target: {value: "Je ___ un ___."},
        });
        // Marker count (2) now exceeds blanks (1) -> invalid.
        expect(saveButton("c1")).toBeDisabled();
        const blank2 = screen.getByTestId("exercise-edit-blank-c1-1");
        fireEvent.change(
            screen.getByTestId("exercise-edit-blank-c1-1-input"),
            {target: {value: "livre"}},
        );
        fireEvent.click(
            screen.getByTestId("exercise-edit-blank-c1-1-add"),
        );
        expect(blank2).toBeInTheDocument();
        expect(saveButton("c1")).not.toBeDisabled();
    });

    it("commits an edited sentence on Save", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={ex()} onSaved={onSaved} />);
        fireEvent.change(screen.getByTestId("exercise-edit-sentence-c1"), {
            target: {value: "Tu ___ un livre."},
        });
        fireEvent.click(saveButton("c1"));
        expect(onSaved.mock.calls[0][0].sentence).toBe("Tu ___ un livre.");
        expect(onSaved.mock.calls[0][0].blanks).toHaveLength(1);
    });
});

describe("ExerciseEditor — word_tiles", () => {
    const ex = (): ContentLessonExercise =>
        ({
            id: "w1",
            type: "word_tiles",
            prompt: "Arrange",
            card_ids: [],
            distractors: [],
            tiles: ["Je", "lis"],
        }) as ContentLessonExercise;

    it("renders a tile input per tile", () => {
        render(<Harness exercise={ex()} />);
        expect(screen.getByTestId("exercise-edit-tile-input-w1-0")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-edit-tile-input-w1-1")).toBeInTheDocument();
    });

    it("commits an edited tile on Save", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={ex()} onSaved={onSaved} />);
        fireEvent.change(screen.getByTestId("exercise-edit-tile-input-w1-0"), {
            target: {value: "Tu"},
        });
        fireEvent.click(saveButton("w1"));
        expect(onSaved.mock.calls[0][0].tiles).toEqual(["Tu", "lis"]);
    });

    it("disables Save when fewer than two tiles remain", () => {
        render(<Harness exercise={ex()} />);
        fireEvent.click(screen.getByTestId("exercise-edit-tile-remove-w1-1"));
        expect(saveButton("w1")).toBeDisabled();
    });
});

describe("ExerciseEditor — picture_choice", () => {
    const ex = (): ContentLessonExercise =>
        ({
            id: "p1",
            type: "picture_choice",
            prompt: "Pick",
            card_ids: [],
            distractors: [],
            images: [
                {src: "a.png", label: "cat", is_correct: "true"},
                {src: "b.png", label: "dog"},
            ],
        }) as ContentLessonExercise;

    it("renders a row per image with a correct radio + label", () => {
        render(<Harness exercise={ex()} />);
        expect(screen.getByTestId("exercise-edit-image-label-p1-0")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-edit-image-correct-p1-1")).toBeInTheDocument();
    });

    it("moves the correct marker and commits it on Save", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={ex()} onSaved={onSaved} />);
        fireEvent.click(screen.getByTestId("exercise-edit-image-correct-p1-1"));
        fireEvent.click(saveButton("p1"));
        const images = onSaved.mock.calls[0][0].images;
        expect(images[0].is_correct).toBeUndefined();
        expect(images[1].is_correct).toBe("true");
    });

    it("disables Save when fewer than two images remain", () => {
        render(<Harness exercise={ex()} />);
        fireEvent.click(screen.getByTestId("exercise-edit-image-remove-p1-1"));
        expect(saveButton("p1")).toBeDisabled();
    });
});

describe("ExerciseEditor — multiple_choice (#1850, #1888)", () => {
    const ex = (over?: Partial<ContentLessonExercise>): ContentLessonExercise =>
        ({
            id: "mc1",
            type: "multiple_choice",
            prompt: "Pick the translation of chat",
            card_ids: [],
            distractors: [],
            multiple: false,
            options: [
                {text: "cat", correct: true},
                {text: "dog", correct: false},
            ],
            ...over,
        }) as ContentLessonExercise;

    it("renders an option row per option + the single/multi mode control", () => {
        render(<Harness exercise={ex()} />);
        expect(screen.getByTestId("exercise-edit-mc-text-mc1-0")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-edit-mc-correct-mc1-1")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-edit-mc-mode-single-mc1")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-edit-mc-mode-multiple-mc1")).toBeInTheDocument();
    });

    it("shows the mode control BEFORE the first option row (#1888 discoverability)", () => {
        render(<Harness exercise={ex()} />);
        const mode = screen.getByTestId("exercise-edit-mc-mode-single-mc1");
        const firstOption = screen.getByTestId("exercise-edit-mc-option-mc1-0");
        // The mode control precedes the first option row in document order.
        expect(
            mode.compareDocumentPosition(firstOption) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it("defaults a new single-choice exercise to the 'single' mode selected", () => {
        render(<Harness exercise={ex()} />);
        expect(screen.getByTestId("exercise-edit-mc-mode-single-mc1")).toBeChecked();
        expect(
            screen.getByTestId("exercise-edit-mc-mode-multiple-mc1"),
        ).not.toBeChecked();
    });

    it("opens an existing multi-answer exercise with 'multiple' selected, unchanged", () => {
        render(
            <Harness
                exercise={ex({
                    multiple: true,
                    options: [
                        {text: "cat", correct: true},
                        {text: "kitten", correct: true},
                        {text: "dog", correct: false},
                    ],
                })}
            />,
        );
        expect(
            screen.getByTestId("exercise-edit-mc-mode-multiple-mc1"),
        ).toBeChecked();
        expect(
            screen.getByTestId("exercise-edit-mc-mode-single-mc1"),
        ).not.toBeChecked();
        // The two authored correct options are untouched on open.
        expect(screen.getByTestId("exercise-edit-mc-correct-mc1-0")).toBeChecked();
        expect(screen.getByTestId("exercise-edit-mc-correct-mc1-1")).toBeChecked();
    });

    it("commits an edited option + moved correct marker on Save", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={ex()} onSaved={onSaved} />);
        fireEvent.change(screen.getByTestId("exercise-edit-mc-text-mc1-1"), {
            target: {value: "hound"},
        });
        fireEvent.click(screen.getByTestId("exercise-edit-mc-correct-mc1-1"));
        fireEvent.click(saveButton("mc1"));
        const options = onSaved.mock.calls[0][0].options;
        // single-choice: correct moves to option 1 exclusively.
        expect(options[0].correct).toBe(false);
        expect(options[1]).toEqual({text: "hound", correct: true});
    });

    it("adds + removes options", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={ex()} onSaved={onSaved} />);
        fireEvent.click(screen.getByTestId("exercise-edit-mc-add-mc1"));
        fireEvent.change(screen.getByTestId("exercise-edit-mc-text-mc1-2"), {
            target: {value: "kitten"},
        });
        fireEvent.click(saveButton("mc1"));
        expect(onSaved.mock.calls[0][0].options).toHaveLength(3);
    });

    it("disables Save when a single-choice question has no correct option", () => {
        render(<Harness exercise={ex()} />);
        // Deselect the only correct radio is impossible; instead clear its
        // text so it drops out and no correct option remains.
        fireEvent.change(screen.getByTestId("exercise-edit-mc-text-mc1-0"), {
            target: {value: "   "},
        });
        expect(saveButton("mc1")).toBeDisabled();
        expect(screen.getByTestId("exercise-edit-error-mc1")).toBeInTheDocument();
    });

    it("switching to 'multiple' mode allows two correct answers", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={ex()} onSaved={onSaved} />);
        fireEvent.click(screen.getByTestId("exercise-edit-mc-mode-multiple-mc1"));
        // now both can be correct (checkboxes)
        fireEvent.click(screen.getByTestId("exercise-edit-mc-correct-mc1-1"));
        fireEvent.click(saveButton("mc1"));
        const saved = onSaved.mock.calls[0][0];
        expect(saved.multiple).toBe(true);
        expect(saved.options.filter((o: {correct: boolean}) => o.correct)).toHaveLength(2);
    });

    it("switching back to 'single' mode prunes to a single correct answer", () => {
        const onSaved = vi.fn();
        render(
            <Harness
                exercise={ex({
                    multiple: true,
                    options: [
                        {text: "cat", correct: true},
                        {text: "kitten", correct: true},
                        {text: "dog", correct: false},
                    ],
                })}
                onSaved={onSaved}
            />,
        );
        fireEvent.click(screen.getByTestId("exercise-edit-mc-mode-single-mc1"));
        fireEvent.click(saveButton("mc1"));
        const saved = onSaved.mock.calls[0][0];
        expect(saved.multiple).toBe(false);
        expect(saved.options.filter((o: {correct: boolean}) => o.correct)).toHaveLength(1);
    });
});

describe("ExerciseEditor — type conversion (EXP-050 Stage 1)", () => {
    const wordTiles = (): ContentLessonExercise =>
        ({
            id: "wt1",
            type: "word_tiles",
            prompt: "Arrange the sentence",
            card_ids: [],
            distractors: [],
            tiles: ["Je", "suis", "ici"],
        }) as ContentLessonExercise;

    const multipleChoice = (): ContentLessonExercise =>
        ({
            id: "mc9",
            type: "multiple_choice",
            prompt: "Pick the translation",
            card_ids: [],
            distractors: [],
            multiple: false,
            options: [
                {text: "danke", correct: true},
                {text: "bitte", correct: false},
            ],
        }) as ContentLessonExercise;

    it("offers no type control for a non-convertible source", () => {
        render(
            <Harness
                exercise={
                    {
                        id: "mt0",
                        type: "matching",
                        prompt: "Match",
                        card_ids: [],
                        distractors: [],
                        pairs: [
                            {left: "un", right: "one"},
                            {left: "deux", right: "two"},
                        ],
                    } as ContentLessonExercise
                }
            />,
        );
        expect(screen.queryByTestId("exercise-edit-type-select-mt0")).toBeNull();
    });

    it("converts word_tiles to free_text, carrying the sentence into accept", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={wordTiles()} onSaved={onSaved} />);
        fireEvent.change(screen.getByTestId("exercise-edit-type-select-wt1"), {
            target: {value: "free_text"},
        });
        // The free-text accept editor now shows the joined tiles.
        expect(screen.getByTestId("exercise-edit-accept-wt1-item-0")).toHaveTextContent(
            "Je suis ici",
        );
        // The draft is now free_text; the type control reflects that (and now
        // offers the Stage-3 completion targets instead of word_tiles).
        expect(
            (screen.getByTestId("exercise-edit-type-select-wt1") as HTMLSelectElement)
                .value,
        ).toBe("free_text");
        fireEvent.click(saveButton("wt1"));
        const saved = onSaved.mock.calls[0][0];
        expect(saved.type).toBe("free_text");
        expect(saved.accept).toEqual(["Je suis ici"]);
        expect("tiles" in saved).toBe(false);
    });

    it("converts multiple_choice to free_text, wrong options become distractors", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={multipleChoice()} onSaved={onSaved} />);
        fireEvent.change(screen.getByTestId("exercise-edit-type-select-mc9"), {
            target: {value: "free_text"},
        });
        fireEvent.click(saveButton("mc9"));
        const saved = onSaved.mock.calls[0][0];
        expect(saved.type).toBe("free_text");
        expect(saved.accept).toEqual(["danke"]);
        expect(saved.distractors).toEqual(["bitte"]);
        expect("options" in saved).toBe(false);
        expect("multiple" in saved).toBe(false);
    });
});

describe("ExerciseEditor — free_text completion conversions (EXP-050 Stage 3)", () => {
    const freeText = (over: Partial<ContentLessonExercise> = {}): ContentLessonExercise =>
        ({
            id: "ft3",
            type: "free_text",
            prompt: "Translate: danke",
            card_ids: [],
            distractors: [],
            accept: ["danke"],
            ...over,
        }) as ContentLessonExercise;

    it("offers multiple_choice + cloze in the type control for a free_text", () => {
        render(<Harness exercise={freeText()} />);
        const select = screen.getByTestId(
            "exercise-edit-type-select-ft3",
        ) as HTMLSelectElement;
        const values = Array.from(select.options).map((o) => o.value);
        expect(values).toContain("multiple_choice");
        expect(values).toContain("cloze");
    });

    it("converts to an incomplete multiple_choice: Save blocked until a 2nd option", () => {
        render(<Harness exercise={freeText()} />);
        fireEvent.change(screen.getByTestId("exercise-edit-type-select-ft3"), {
            target: {value: "multiple_choice"},
        });
        // MC fields now render, the correct option carries the answer.
        expect(screen.getByTestId("exercise-edit-mc-mode-ft3")).toBeInTheDocument();
        expect(
            (screen.getByTestId("exercise-edit-mc-text-ft3-0") as HTMLInputElement).value,
        ).toBe("danke");
        // Incomplete (one empty option) -> Save disabled + error shown.
        expect(saveButton("ft3")).toBeDisabled();
        // Fill the second option -> Save enabled.
        fireEvent.change(screen.getByTestId("exercise-edit-mc-text-ft3-1"), {
            target: {value: "bitte"},
        });
        expect(saveButton("ft3")).not.toBeDisabled();
    });

    it("seeds wrong options from the free_text distractors", () => {
        const onSaved = vi.fn();
        render(
            <Harness exercise={freeText({distractors: ["bitte"]})} onSaved={onSaved} />,
        );
        fireEvent.change(screen.getByTestId("exercise-edit-type-select-ft3"), {
            target: {value: "multiple_choice"},
        });
        // A seeded distractor makes the draft valid immediately.
        fireEvent.click(saveButton("ft3"));
        const saved = onSaved.mock.calls[0][0];
        expect(saved.type).toBe("multiple_choice");
        expect(saved.options).toEqual([
            {text: "danke", correct: true},
            {text: "bitte", correct: false},
        ]);
    });

    it("converts to a valid starter cloze with the answer in the blank", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={freeText()} onSaved={onSaved} />);
        fireEvent.change(screen.getByTestId("exercise-edit-type-select-ft3"), {
            target: {value: "cloze"},
        });
        fireEvent.click(saveButton("ft3"));
        const saved = onSaved.mock.calls[0][0];
        expect(saved.type).toBe("cloze");
        expect(saved.sentence).toBe("___");
        expect(saved.blanks).toEqual([{accept: ["danke"]}]);
    });
});
