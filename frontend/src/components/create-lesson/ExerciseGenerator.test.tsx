/**
 * Tests for the Lesson Creator exercise generator (Phase 65C, #1760).
 *
 * The "Number of exercises" value is directly typeable via a number
 * input that stays in sync with the range slider (both drive the shared
 * ``config.count``). These tests pin the two-way sync, the clamp on
 * out-of-range / non-numeric input, and that the committed value is the
 * one generation consumes.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {describe, expect, it, vi} from "vitest";

import ExerciseGenerator, {
    EXERCISE_COUNT_MAX,
    EXERCISE_COUNT_MIN,
} from "./ExerciseGenerator";
import {
    DEFAULT_EXERCISE_GEN_CONFIG,
    type ExerciseGenConfig,
} from "../../lib/content/lesson/exercise/exercise-generator";
import type {ContentLessonExercise} from "../../storage/types";

/**
 * Stateful harness: holds the config so the slider and the number
 * input actually round-trip through ``config.count`` (a faithful
 * both-directions sync test, not a callback snapshot). ``onGenerate``
 * records the count generation would consume at click time.
 */
function Harness({
    initialCount = DEFAULT_EXERCISE_GEN_CONFIG.count,
    onGenerateCount,
}: {
    initialCount?: number;
    onGenerateCount?: (count: number) => void;
}) {
    const [config, setConfig] = useState<ExerciseGenConfig>({
        ...DEFAULT_EXERCISE_GEN_CONFIG,
        count: initialCount,
    });
    const exercises: ContentLessonExercise[] = [];
    return (
        <ExerciseGenerator
            exercises={exercises}
            config={config}
            onConfigChange={setConfig}
            onGenerate={() => onGenerateCount?.(config.count)}
            onReorder={vi.fn()}
            onDelete={vi.fn()}
            onUpdate={vi.fn()}
        />
    );
}

/** Harness holding a real exercise list so the row edit flow (#1844) can
 *  round-trip an update / delete through the generator's callbacks. */
function ListHarness({
    initial,
    onDelete = vi.fn(),
    onUpdate = vi.fn(),
}: {
    initial: ContentLessonExercise[];
    onDelete?: (id: string) => void;
    onUpdate?: (id: string, updated: ContentLessonExercise) => void;
}) {
    const [exercises, setExercises] = useState(initial);
    return (
        <ExerciseGenerator
            exercises={exercises}
            config={DEFAULT_EXERCISE_GEN_CONFIG}
            onConfigChange={vi.fn()}
            onGenerate={vi.fn()}
            onReorder={setExercises}
            onDelete={(id) => {
                onDelete(id);
                setExercises((prev) => prev.filter((e) => e.id !== id));
            }}
            onUpdate={(id, updated) => {
                onUpdate(id, updated);
                setExercises((prev) =>
                    prev.map((e) => (e.id === id ? updated : e)),
                );
            }}
        />
    );
}

function freeTextEx(id: string): ContentLessonExercise {
    return {
        id,
        type: "free_text",
        prompt: "Translate: Bonjour",
        card_ids: [],
        distractors: [],
        accept: ["Guten Tag"],
    } as ContentLessonExercise;
}

describe("ExerciseGenerator — per-row edit (#1844)", () => {
    it("shows an edit + delete control on each row, drag handle present", () => {
        render(<ListHarness initial={[freeTextEx("f1")]} />);
        expect(screen.getByTestId("exercise-edit-f1")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-delete-f1")).toBeInTheDocument();
    });

    it("opens the inline editor with the type-specific fields on edit", () => {
        render(<ListHarness initial={[freeTextEx("f1")]} />);
        fireEvent.click(screen.getByTestId("exercise-edit-f1"));
        expect(screen.getByTestId("exercise-editor-f1")).toBeInTheDocument();
        expect(screen.getByTestId("exercise-edit-accept-f1")).toBeInTheDocument();
    });

    it("commits an edit through onUpdate and closes the editor", () => {
        const onUpdate = vi.fn();
        render(<ListHarness initial={[freeTextEx("f1")]} onUpdate={onUpdate} />);
        fireEvent.click(screen.getByTestId("exercise-edit-f1"));
        fireEvent.change(screen.getByTestId("exercise-edit-prompt-f1"), {
            target: {value: "Say hello"},
        });
        fireEvent.click(screen.getByTestId("exercise-edit-save-f1"));
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate.mock.calls[0][0]).toBe("f1");
        expect(onUpdate.mock.calls[0][1].prompt).toBe("Say hello");
        expect(screen.queryByTestId("exercise-editor-f1")).not.toBeInTheDocument();
    });

    it("cancel closes the editor without calling onUpdate", () => {
        const onUpdate = vi.fn();
        render(<ListHarness initial={[freeTextEx("f1")]} onUpdate={onUpdate} />);
        fireEvent.click(screen.getByTestId("exercise-edit-f1"));
        fireEvent.click(screen.getByTestId("exercise-edit-cancel-f1"));
        expect(onUpdate).not.toHaveBeenCalled();
        expect(screen.queryByTestId("exercise-editor-f1")).not.toBeInTheDocument();
    });

    it("regression: delete still removes the row", () => {
        const onDelete = vi.fn();
        render(<ListHarness initial={[freeTextEx("f1")]} onDelete={onDelete} />);
        fireEvent.click(screen.getByTestId("exercise-delete-f1"));
        expect(onDelete).toHaveBeenCalledWith("f1");
        expect(screen.queryByTestId("exercise-row-f1")).not.toBeInTheDocument();
    });
});

function numberInput(): HTMLInputElement {
    return screen.getByTestId("exercise-count-input") as HTMLInputElement;
}
function slider(): HTMLInputElement {
    return screen.getByTestId("exercise-count-slider") as HTMLInputElement;
}

describe("ExerciseGenerator — count number input (#1760)", () => {
    it("renders a labelled, numeric-keyboard number input beside the slider", () => {
        render(<Harness />);
        const input = numberInput();
        expect(input).toBeInTheDocument();
        expect(input.type).toBe("number");
        expect(input.getAttribute("inputmode")).toBe("numeric");
        expect(input.getAttribute("min")).toBe(String(EXERCISE_COUNT_MIN));
        expect(input.getAttribute("max")).toBe(String(EXERCISE_COUNT_MAX));
        // Accessible name present (aria-label or associated label).
        expect(input.getAttribute("aria-label")).toBeTruthy();
        // The slider is still there.
        expect(slider()).toBeInTheDocument();
    });

    it("typing a value commits it and moves the slider (input -> slider)", () => {
        render(<Harness initialCount={10} />);
        fireEvent.change(numberInput(), {target: {value: "14"}});
        fireEvent.blur(numberInput());
        expect(numberInput().value).toBe("14");
        expect(slider().value).toBe("14");
    });

    it("moving the slider updates the number input (slider -> input)", () => {
        render(<Harness initialCount={10} />);
        fireEvent.change(slider(), {target: {value: "8"}});
        expect(numberInput().value).toBe("8");
        expect(slider().value).toBe("8");
    });

    it("clamps a too-high value down to the max on commit", () => {
        render(<Harness initialCount={10} />);
        fireEvent.change(numberInput(), {target: {value: "999"}});
        fireEvent.blur(numberInput());
        expect(numberInput().value).toBe(String(EXERCISE_COUNT_MAX));
        expect(slider().value).toBe(String(EXERCISE_COUNT_MAX));
    });

    it("clamps a too-low value up to the min on commit", () => {
        render(<Harness initialCount={10} />);
        fireEvent.change(numberInput(), {target: {value: "0"}});
        fireEvent.blur(numberInput());
        expect(numberInput().value).toBe(String(EXERCISE_COUNT_MIN));
        expect(slider().value).toBe(String(EXERCISE_COUNT_MIN));
    });

    it("clamps a negative value up to the min on commit", () => {
        render(<Harness initialCount={10} />);
        fireEvent.change(numberInput(), {target: {value: "-3"}});
        fireEvent.blur(numberInput());
        expect(numberInput().value).toBe(String(EXERCISE_COUNT_MIN));
    });

    it("falls back to the min for a non-numeric / empty value on commit", () => {
        render(<Harness initialCount={12} />);
        fireEvent.change(numberInput(), {target: {value: ""}});
        fireEvent.blur(numberInput());
        expect(numberInput().value).toBe(String(EXERCISE_COUNT_MIN));
        expect(slider().value).toBe(String(EXERCISE_COUNT_MIN));
    });

    it("commits on Enter as well as on blur", () => {
        render(<Harness initialCount={10} />);
        fireEvent.change(numberInput(), {target: {value: "16"}});
        fireEvent.keyDown(numberInput(), {key: "Enter"});
        expect(slider().value).toBe("16");
    });

    it("feeds the committed value into generation, not the display text", () => {
        const onGenerateCount = vi.fn();
        render(<Harness initialCount={10} onGenerateCount={onGenerateCount} />);
        fireEvent.change(numberInput(), {target: {value: "17"}});
        fireEvent.blur(numberInput());
        fireEvent.click(screen.getByTestId("exercise-generate"));
        expect(onGenerateCount).toHaveBeenCalledWith(17);
    });
});
