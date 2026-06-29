/**
 * Integration regression guard for the #1195 cloze-multiselect render path
 * (bug report: "a real multiselect-cloze renders as a single-select
 * dropdown instead of checkboxes").
 *
 * The unit tests for ClozeMultiSelect + the ClozeExercise dispatch already
 * pin the renderer in isolation. This file closes the gap one level up: it
 * drives a content-set-SHAPED multiselect cloze step through the REAL
 * ``ExerciseDispatcher`` — the same shell ``LessonStepView`` /
 * ``Review`` use — and asserts the checkbox group renders and NO
 * ``<select>`` dropdown is produced. That pins the exact path the user
 * exercises in a live lesson (content JSON → step.exercise → dispatcher →
 * cloze dispatch → ClozeMultiSelect), so a future regression that drops
 * ``cloze_mode`` between the step and the renderer, or routes multiselect
 * to the blank-based dropdown, fails here.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {createRef} from "react";
import {describe, expect, it, vi} from "vitest";

import {ExerciseDispatcher} from "./ExerciseDispatcher";
import {I18nProvider} from "../../../hooks/ui/useI18n";
import type {ExerciseHandle} from "./exercise-control";
import type {ContentLessonStep} from "../../../storage/types";

/** A content-set multiselect cloze step, shaped exactly as #1195 authors it:
 *  ``cloze_mode: "multiselect"``, the ``sentence`` is the question stem (no
 *  ``___`` markers), ``accept`` (all correct) + ``distractors`` are the
 *  option lists, and there are NO ``blanks``. */
const MULTISELECT_STEP: ContentLessonStep = {
    id: "step-ms",
    type: "exercise",
    exercise: {
        id: "ex-ms-integration",
        type: "cloze",
        cloze_mode: "multiselect",
        prompt: "Select all that apply.",
        card_ids: [],
        sentence: "Which of these are persuasion principles?",
        accept: ["Reciprocity", "Scarcity"],
        distractors: ["Gravity", "Entropy"],
    },
} as ContentLessonStep;

function renderDispatcher(step: ContentLessonStep) {
    return render(
        <I18nProvider>
            <ExerciseDispatcher
                ref={createRef<ExerciseHandle>()}
                step={step}
                setId="persuasion-set"
                lessonId="01-influence.json"
                onComplete={vi.fn(async () => {})}
            />
        </I18nProvider>,
    );
}

describe("ExerciseDispatcher → cloze multiselect (#1195 regression)", () => {
    it("routes a content-set multiselect cloze to the checkbox renderer", () => {
        renderDispatcher(MULTISELECT_STEP);
        // The multiselect (checkbox-group) renderer mounts...
        expect(
            screen.getByTestId("cloze-multiselect-exercise"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("cloze-multiselect-exercise"),
        ).toHaveAttribute("data-cloze-mode", "multiselect");
        // ...with one checkbox per option (accept 2 + distractors 2).
        expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    });

    it("does NOT render a single-select dropdown for a multiselect cloze", () => {
        const {container} = renderDispatcher(MULTISELECT_STEP);
        // The exact reported symptom: a <select> dropdown. There must be
        // none — multiselect is a checkbox group, never the blank-based
        // ClozeExercise select mode.
        expect(container.querySelector("select")).toBeNull();
        expect(screen.queryByTestId("cloze-select-0")).toBeNull();
        // The blank-based renderer must not mount at all.
        expect(screen.queryByTestId("cloze-exercise")).toBeNull();
    });

    it("preserves cloze_mode through the dispatcher (no field drop)", () => {
        // Guards the verify-first concern: the field survives from the
        // step.exercise to the renderer prop. If a mapper ever drops
        // cloze_mode, the checkbox group disappears and this fails.
        renderDispatcher(MULTISELECT_STEP);
        expect(
            screen.getByTestId("cloze-multiselect-options"),
        ).toBeInTheDocument();
    });
});
