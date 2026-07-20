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

describe("ExerciseEditor — multiple_choice (#1850)", () => {
    const ex = (): ContentLessonExercise =>
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
        }) as ContentLessonExercise;

    it("renders an option row per option + the multiple toggle", () => {
        render(<Harness exercise={ex()} />);
        expect(screen.getByTestId("exercise-edit-mc-text-mc1-0")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-edit-mc-correct-mc1-1")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-edit-mc-multiple-mc1")).toBeInTheDocument();
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

    it("multiple toggle switches to checkboxes and allows two correct", () => {
        const onSaved = vi.fn();
        render(<Harness exercise={ex()} onSaved={onSaved} />);
        fireEvent.click(screen.getByTestId("exercise-edit-mc-multiple-mc1"));
        // now both can be correct
        fireEvent.click(screen.getByTestId("exercise-edit-mc-correct-mc1-1"));
        fireEvent.click(saveButton("mc1"));
        const saved = onSaved.mock.calls[0][0];
        expect(saved.multiple).toBe(true);
        expect(saved.options.filter((o: {correct: boolean}) => o.correct)).toHaveLength(2);
    });
});
