/**
 * The panel is where "this is a proposal" has to be visible (#2308). These
 * tests pin what the learner can SEE before deciding, not just what the
 * derivation computed.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import UpdateGuardPlanPanel from "./UpdateGuardPlanPanel";
import type {RemapPlan} from "../../lib/content/update/remap-plan";

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

function panel(plan: RemapPlan, onChange = vi.fn()) {
    render(
        <UpdateGuardPlanPanel plan={plan} carryOver onCarryOverChange={onChange} />,
    );
    return onChange;
}

describe("UpdateGuardPlanPanel (#2308)", () => {
    it("lists the actual pairs, so the proposal can be judged", () => {
        panel({certain: [remap("こんにちは", "こんにちは (konnichiwa)")], uncertain: []});
        expect(screen.getByText("こんにちは")).toBeInTheDocument();
        expect(screen.getByText("こんにちは (konnichiwa)")).toBeInTheDocument();
    });

    it("collapses a long list but names how many are hidden", () => {
        panel({
            certain: [
                remap("a", "a1"), remap("b", "b1"), remap("c", "c1"),
                remap("d", "d1"), remap("e", "e1"),
            ],
            uncertain: [],
        });
        expect(screen.getByText("and {count} more".replace("{count}", "2"))).toBeInTheDocument();
    });

    it("names the count it refuses to assign", () => {
        panel({
            certain: [],
            uncertain: [
                {identity: {lesson_id: "01.json", exercise_id: "ex-1", element_key: "x"}, reason: "reordered"},
            ],
        });
        expect(screen.getByTestId("update-guard-unmappable").textContent).toContain("1");
    });

    it("the carry-over decision is a real control, not a label", () => {
        const onChange = panel({certain: [remap("a", "a1")], uncertain: []});
        fireEvent.click(screen.getByTestId("update-guard-carry-over"));
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it("renders nothing when there is neither a proposal nor a refusal", () => {
        const {container} = render(
            <UpdateGuardPlanPanel
                plan={{certain: [], uncertain: []}}
                carryOver
                onCarryOverChange={vi.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the refusal even when nothing at all can be carried over", () => {
        panel({
            certain: [],
            uncertain: [
                {identity: {lesson_id: "01.json", exercise_id: "ex-1", element_key: "x"}, reason: "shifted"},
            ],
        });
        expect(screen.queryByTestId("update-guard-carry-over")).not.toBeInTheDocument();
        expect(screen.getByTestId("update-guard-unmappable")).toBeInTheDocument();
    });
});
