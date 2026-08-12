/**
 * The panel is where "this is a proposal" has to be visible (#2308, AUTH-05).
 * These tests pin what the learner can SEE before deciding, not just what
 * the derivation computed.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import UpdateGuardPlanPanel from "./UpdateGuardPlanPanel";
import type {SetUpdatePlan} from "../../lib/content/update/plan-set-update";
import type {RemapPlan} from "../../lib/content/update/remap-plan";
import type {ExerciseRemapPlan} from "../../lib/content/update/exercise-remap-plan";

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb: string) => fb, lang: "de"}),
}));

const remap = (old: string, next: string) => ({
    set_id: "ja-a1",
    lesson_id: "01.json",
    exercise_id: "ex-1",
    old,
    new: next,
});

const EMPTY_EXERCISE: ExerciseRemapPlan = {certain: [], uncertain: []};

function setUpdatePlan(
    element: RemapPlan,
    exercise: ExerciseRemapPlan = EMPTY_EXERCISE,
): SetUpdatePlan {
    return {exercise, element};
}

function panel(plan: SetUpdatePlan, onChange = vi.fn()) {
    render(
        <UpdateGuardPlanPanel plan={plan} carryOver onCarryOverChange={onChange} />,
    );
    return onChange;
}

describe("UpdateGuardPlanPanel (#2308)", () => {
    it("lists the actual pairs, so the proposal can be judged", () => {
        panel(
            setUpdatePlan({
                certain: [remap("こんにちは", "こんにちは (konnichiwa)")],
                uncertain: [],
            }),
        );
        expect(screen.getByText("こんにちは")).toBeInTheDocument();
        expect(screen.getByText("こんにちは (konnichiwa)")).toBeInTheDocument();
    });

    it("collapses a long list but names how many are hidden", () => {
        panel(
            setUpdatePlan({
                certain: [
                    remap("a", "a1"), remap("b", "b1"), remap("c", "c1"),
                    remap("d", "d1"), remap("e", "e1"),
                ],
                uncertain: [],
            }),
        );
        expect(screen.getByText("and {count} more".replace("{count}", "2"))).toBeInTheDocument();
    });

    it("names the count it refuses to assign", () => {
        panel(
            setUpdatePlan({
                certain: [],
                uncertain: [
                    {identity: {lesson_id: "01.json", exercise_id: "ex-1", element_key: "x"}, reason: "reordered"},
                ],
            }),
        );
        expect(screen.getByTestId("update-guard-unmappable").textContent).toContain("1");
    });

    it("the carry-over decision is a real control, not a label", () => {
        const onChange = panel(setUpdatePlan({certain: [remap("a", "a1")], uncertain: []}));
        fireEvent.click(screen.getByTestId("update-guard-carry-over"));
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it("renders nothing when there is neither a proposal nor a refusal", () => {
        const {container} = render(
            <UpdateGuardPlanPanel
                plan={setUpdatePlan({certain: [], uncertain: []})}
                carryOver
                onCarryOverChange={vi.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the refusal even when nothing at all can be carried over", () => {
        panel(
            setUpdatePlan({
                certain: [],
                uncertain: [
                    {identity: {lesson_id: "01.json", exercise_id: "ex-1", element_key: "x"}, reason: "shifted"},
                ],
            }),
        );
        expect(screen.queryByTestId("update-guard-carry-over")).not.toBeInTheDocument();
        expect(screen.getByTestId("update-guard-unmappable")).toBeInTheDocument();
    });

    describe("AUTH-05: exercise-id remaps count toward the totals without appearing in the readable preview", () => {
        it("an exercise-only certain remap still shows the carry-over checkbox with the right count", () => {
            panel(
                setUpdatePlan(
                    {certain: [], uncertain: []},
                    {
                        certain: [{set_id: "ja-a1", lesson_id: "01.json", old: "ex-1", new: "ex-2"}],
                        uncertain: [],
                    },
                ),
            );
            expect(screen.getByTestId("update-guard-carry-over")).toBeInTheDocument();
            expect(screen.getByText(/\(1\)/)).toBeInTheDocument();
            // The technical slug pair never renders in the preview list -
            // the panel is scoped to the readable answer-text pairs only.
            expect(screen.queryByTestId("update-guard-plan-preview")).not.toBeInTheDocument();
        });

        it("combines exercise and element counts in the single checkbox label", () => {
            panel(
                setUpdatePlan(
                    {certain: [remap("a", "a1")], uncertain: []},
                    {
                        certain: [{set_id: "ja-a1", lesson_id: "01.json", old: "ex-1", new: "ex-2"}],
                        uncertain: [],
                    },
                ),
            );
            expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
            // Still shows the one legible pair - the exercise-level remap
            // does not appear in the preview, but does not hide the element
            // one either.
            expect(screen.getByText("a")).toBeInTheDocument();
        });

        it("combines exercise and element uncertain counts in the single refusal message", () => {
            panel(
                setUpdatePlan(
                    {
                        certain: [],
                        uncertain: [
                            {identity: {lesson_id: "01.json", exercise_id: "ex-1", element_key: "x"}, reason: "shifted"},
                        ],
                    },
                    {
                        certain: [],
                        uncertain: [
                            {identity: {lesson_id: "01.json", exercise_id: "ex-2"}, reason: "reordered", candidate: "ex-3"},
                        ],
                    },
                ),
            );
            expect(screen.getByTestId("update-guard-unmappable").textContent).toContain("2");
        });
    });
});
