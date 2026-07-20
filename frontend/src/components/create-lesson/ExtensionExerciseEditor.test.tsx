/**
 * Tests for the extension-exercise inline editor (#1852, editors 1+2).
 *
 * One group per authored extension type covers: the type-specific fields
 * render, an edit round-trips through ``onSave`` (after normalization), and
 * the Save gate reflects the shipped payload validator. The pure
 * validation/normalization rules are pinned in ``extension-edit.test.ts``.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {describe, expect, it, vi} from "vitest";

import ExtensionExerciseEditor from "./ExtensionExerciseEditor";
import {
    CATEGORIZATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
    GRADED_QUIZ_EXT_TYPE,
    READING_COMPREHENSION_EXT_TYPE,
} from "../../lib/content/lesson/extension/extension-edit";
import type {ContentLessonExercise} from "../../storage/types";

/** Stateful harness so edits round-trip through the exercise record. */
function Harness({exercise}: {exercise: ContentLessonExercise}) {
    const [ex, setEx] = useState(exercise);
    const [saved, setSaved] = useState<ContentLessonExercise | null>(null);
    if (saved) {
        return <div data-testid="saved-json">{JSON.stringify(saved)}</div>;
    }
    return (
        <ExtensionExerciseEditor
            exercise={ex}
            onSave={(updated) => {
                setEx(updated);
                setSaved(updated);
            }}
            onCancel={vi.fn()}
        />
    );
}

function saveButton(id: string): HTMLButtonElement {
    return screen.getByTestId(`exercise-ext-save-${id}`) as HTMLButtonElement;
}

function savedPayload(): Record<string, unknown> {
    const raw = screen.getByTestId("saved-json").textContent ?? "{}";
    return JSON.parse(raw).ext_payload as Record<string, unknown>;
}

describe("ExtensionExerciseEditor — categorization", () => {
    const ex = (): ContentLessonExercise =>
        ({
            id: "c1",
            type: CATEGORIZATION_EXT_TYPE,
            prompt: "Sort each signal",
            card_ids: [],
            distractors: [],
            ext_payload: {
                categories: [
                    {name: "Sight", items: ["flat hand"]},
                    {name: "Sound", items: ["Sit"]},
                ],
            },
        }) as ContentLessonExercise;

    it("renders a category editor per category", () => {
        render(<Harness exercise={ex()} />);
        expect(
            screen.getByTestId("exercise-ext-cat-name-c1-0"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("exercise-ext-cat-name-c1-1"),
        ).toBeInTheDocument();
    });

    it("commits an edited category name on Save", () => {
        render(<Harness exercise={ex()} />);
        fireEvent.change(screen.getByTestId("exercise-ext-cat-name-c1-0"), {
            target: {value: "Visual"},
        });
        fireEvent.click(saveButton("c1"));
        const categories = savedPayload().categories as {name: string}[];
        expect(categories[0].name).toBe("Visual");
    });

    it("disables Save when a category name is blank", () => {
        const blank = ex();
        (blank.ext_payload as {categories: {name: string}[]}).categories[0].name =
            "";
        render(<Harness exercise={blank} />);
        expect(saveButton("c1")).toBeDisabled();
        expect(screen.getByTestId("exercise-ext-error-c1")).toBeInTheDocument();
    });
});

describe("ExtensionExerciseEditor — error correction", () => {
    const ex = (): ContentLessonExercise =>
        ({
            id: "e1",
            type: ERROR_CORRECTION_EXT_TYPE,
            prompt: "Fix the wrong word",
            card_ids: [],
            distractors: [],
            ext_payload: {
                tokens: ["The", "dog", "follow"],
                error_index: 2,
                accept: ["follows"],
            },
        }) as ContentLessonExercise;

    it("renders a token editor per word with the error radio checked", () => {
        render(<Harness exercise={ex()} />);
        expect(
            screen.getByTestId("exercise-ext-token-input-e1-2"),
        ).toBeInTheDocument();
        const radio = screen.getByTestId(
            "exercise-ext-token-error-e1-2",
        ) as HTMLInputElement;
        expect(radio.checked).toBe(true);
    });

    it("moves the error marker when another word is marked", () => {
        render(<Harness exercise={ex()} />);
        fireEvent.click(screen.getByTestId("exercise-ext-token-error-e1-1"));
        fireEvent.click(saveButton("e1"));
        expect(savedPayload().error_index).toBe(1);
    });

    it("disables Save when no accepted correction exists", () => {
        const blank = ex();
        (blank.ext_payload as {accept: string[]}).accept = [];
        render(<Harness exercise={blank} />);
        expect(saveButton("e1")).toBeDisabled();
        expect(screen.getByTestId("exercise-ext-error-e1")).toBeInTheDocument();
    });
});

describe("ExtensionExerciseEditor — reading comprehension", () => {
    const ex = (): ContentLessonExercise =>
        ({
            id: "r1",
            type: READING_COMPREHENSION_EXT_TYPE,
            prompt: "Read and answer",
            card_ids: [],
            distractors: [],
            ext_payload: {
                passage: "Rex ran into the garden.",
                questions: [
                    {
                        prompt: "Where did Rex run?",
                        type: "multiple_choice",
                        options: [
                            {text: "The garden", correct: true},
                            {text: "The street", correct: false},
                        ],
                        accept: [],
                    },
                ],
            },
        }) as ContentLessonExercise;

    it("renders the passage + a question editor", () => {
        render(<Harness exercise={ex()} />);
        expect(screen.getByTestId("exercise-ext-rc-passage-r1")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-ext-rc-q-r1-0")).toBeInTheDocument();
    });

    it("commits an edited passage on Save (drops the unused accept branch)", () => {
        render(<Harness exercise={ex()} />);
        fireEvent.change(screen.getByTestId("exercise-ext-rc-passage-r1"), {
            target: {value: "A new passage."},
        });
        fireEvent.click(saveButton("r1"));
        const payload = savedPayload() as {
            passage: string;
            questions: {accept?: unknown}[];
        };
        expect(payload.passage).toBe("A new passage.");
        expect(payload.questions[0].accept).toBeUndefined();
    });

    it("disables Save when the passage is blank", () => {
        const blank = ex();
        (blank.ext_payload as {passage: string}).passage = "";
        render(<Harness exercise={blank} />);
        expect(saveButton("r1")).toBeDisabled();
        expect(screen.getByTestId("exercise-ext-error-r1")).toBeInTheDocument();
    });
});

describe("ExtensionExerciseEditor — graded quiz", () => {
    const ex = (): ContentLessonExercise =>
        ({
            id: "q1",
            type: GRADED_QUIZ_EXT_TYPE,
            prompt: "Answer the quiz",
            card_ids: [],
            distractors: [],
            ext_payload: {
                pass_threshold: 60,
                questions: [
                    {
                        prompt: "2+2?",
                        type: "multiple_choice",
                        options: [
                            {text: "4", correct: true},
                            {text: "5", correct: false},
                        ],
                        accept: [],
                        points: 2,
                    },
                ],
            },
        }) as ContentLessonExercise;

    it("renders the threshold + points fields", () => {
        render(<Harness exercise={ex()} />);
        expect(
            screen.getByTestId("exercise-ext-gq-threshold-q1"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("exercise-ext-gq-q-q1-0-points"),
        ).toBeInTheDocument();
    });

    it("commits an edited points value on Save", () => {
        render(<Harness exercise={ex()} />);
        fireEvent.change(screen.getByTestId("exercise-ext-gq-q-q1-0-points"), {
            target: {value: "5"},
        });
        fireEvent.click(saveButton("q1"));
        const payload = savedPayload() as {questions: {points: number}[]};
        expect(payload.questions[0].points).toBe(5);
    });

    it("disables Save when points are not positive", () => {
        render(<Harness exercise={ex()} />);
        fireEvent.change(screen.getByTestId("exercise-ext-gq-q-q1-0-points"), {
            target: {value: "0"},
        });
        expect(saveButton("q1")).toBeDisabled();
        expect(screen.getByTestId("exercise-ext-error-q1")).toBeInTheDocument();
    });
});
