/**
 * Tests for the extension-authoring wizard branch (#1852): the add / edit /
 * delete list on step 2 and the review + save surface on step 3. Mirrors the
 * core step-3 list interaction; the inline editing itself is pinned in
 * ``ExtensionExerciseEditor.test.tsx``.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {describe, expect, it, vi} from "vitest";

import ExtensionSteps from "./ExtensionSteps";
import {
    CATEGORIZATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
} from "../../lib/content/lesson/extension/extension-edit";
import type {LessonMeta} from "../../lib/content/lesson/lesson-draft";
import type {ContentLessonExercise} from "../../storage/types";

const META: LessonMeta = {
    title: "Dog Signals",
    titleNative: "",
    sourceLanguage: "de",
    targetLanguage: "en",
    level: "A1",
    description: "",
    author: "",
};

const t = (_key: string, fallback?: string) => fallback ?? _key;

function completeCategorization(id: string): ContentLessonExercise {
    return {
        id,
        type: CATEGORIZATION_EXT_TYPE,
        prompt: "Sort",
        card_ids: [],
        distractors: [],
        ext_payload: {
            categories: [
                {name: "A", items: ["x"]},
                {name: "B", items: ["y"]},
            ],
        },
    } as ContentLessonExercise;
}

/** Harness owning the exercises array + step so add/delete round-trip. */
function Harness({
    step = 2,
    initial = [],
    onSaveLocal = vi.fn(),
}: {
    step?: number;
    initial?: ContentLessonExercise[];
    onSaveLocal?: () => void;
}) {
    const [exercises, setExercises] = useState<ContentLessonExercise[]>(initial);
    return (
        <ExtensionSteps
            step={step}
            saved={false}
            meta={META}
            exercises={exercises}
            advanceBlocked={false}
            saving={false}
            onAddExercise={(ex) => setExercises((prev) => [...prev, ex])}
            onUpdateExercise={(id, updated) =>
                setExercises((prev) =>
                    prev.map((ex) => (ex.id === id ? updated : ex)),
                )
            }
            onDeleteExercise={(id) =>
                setExercises((prev) => prev.filter((ex) => ex.id !== id))
            }
            onSaveLocal={onSaveLocal}
            t={t}
        />
    );
}

describe("ExtensionSteps — step 2 authoring", () => {
    it("renders the heading, notice, and add control", () => {
        render(<Harness />);
        expect(screen.getByTestId("extension-list")).toBeInTheDocument();
        expect(screen.getByTestId("extension-add")).toBeInTheDocument();
    });

    it("offers both wizard extension types in the picker", () => {
        render(<Harness />);
        fireEvent.click(screen.getByTestId("extension-add"));
        expect(
            screen.getByTestId("extension-add-type-categorization"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("extension-add-type-error-correction"),
        ).toBeInTheDocument();
    });

    it("adds a blank exercise that opens directly in the editor", () => {
        render(<Harness />);
        fireEvent.click(screen.getByTestId("extension-add"));
        fireEvent.click(screen.getByTestId("extension-add-type-error-correction"));
        // Auto-edit: the inline editor for the new exercise is shown.
        const editor = screen.getByTestId(/^exercise-ext-editor-/);
        expect(editor).toBeInTheDocument();
    });

    it("deletes an exercise row", () => {
        render(<Harness initial={[completeCategorization("c1")]} />);
        expect(screen.getByTestId("extension-row-c1")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("extension-delete-c1"));
        expect(screen.queryByTestId("extension-row-c1")).not.toBeInTheDocument();
    });

    it("shows the advance-blocked hint when set", () => {
        render(
            <ExtensionSteps
                step={2}
                saved={false}
                meta={META}
                exercises={[]}
                advanceBlocked
                saving={false}
                onAddExercise={vi.fn()}
                onUpdateExercise={vi.fn()}
                onDeleteExercise={vi.fn()}
                onSaveLocal={vi.fn()}
                t={t}
            />,
        );
        expect(
            screen.getByTestId("create-lesson-extension-error"),
        ).toBeInTheDocument();
    });
});

describe("ExtensionSteps — step 3 review", () => {
    it("shows the exercise count and saves locally", () => {
        const onSaveLocal = vi.fn();
        render(
            <Harness
                step={3}
                initial={[
                    completeCategorization("c1"),
                    {
                        id: "e1",
                        type: ERROR_CORRECTION_EXT_TYPE,
                        prompt: "Fix",
                        card_ids: [],
                        distractors: [],
                        ext_payload: {tokens: ["a", "b"], error_index: 0, accept: ["c"]},
                    } as ContentLessonExercise,
                ]}
                onSaveLocal={onSaveLocal}
            />,
        );
        expect(screen.getByTestId("extension-review-count")).toHaveTextContent("2");
        fireEvent.click(screen.getByTestId("create-lesson-save-local"));
        expect(onSaveLocal).toHaveBeenCalledOnce();
    });
});
