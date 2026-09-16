/**
 * Tests for the HotspotExercise renderer (#3110, ``ext:al-hotspot``).
 *
 * Pins the click-to-select UX + scoring contract, mirroring
 * PictureChoiceExercise's "select then check" pattern:
 * - Initial render: prompt + image + no selection.
 * - A click inside a zone (rect or circle, edges inclusive) selects it.
 * - A click outside every zone (a miss) selects nothing.
 * - Submit disabled until a zone is selected.
 * - Submit reports {correct: 1, total: 1} for the correct zone.
 * - Submit reports {correct: 0, total: 1} for a distractor zone.
 * - Try-again clears the selection.
 * - reviewed reconstruction restores the exact selection, locked.
 * - Malformed payload surfaces the empty-state testid.
 *
 * Coordinate math: ``getBoundingClientRect`` is mocked to a fixed 100x100
 * box at the origin, so a click's ``clientX``/``clientY`` map 1:1 onto the
 * payload's 0-100 percentage coordinates.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import HotspotExercise from "./HotspotExercise";
import type {ContentLessonExercise} from "../../../../storage/types";
import {HOTSPOT_EXT_TYPE} from "../../../../lib/exercises/payload/hotspot";

const EXERCISE: ContentLessonExercise = {
    id: "ex-hotspot",
    type: HOTSPOT_EXT_TYPE,
    prompt: "Click the capital.",
    card_ids: [],
    distractors: [],
    ext_payload: {
        src: "data:image/png;base64,AAAA",
        zones: [
            {shape: "rect", coords: {x: 10, y: 10, width: 20, height: 20}, is_correct: "true"},
            {shape: "circle", coords: {cx: 70, cy: 70, radius: 15}},
        ],
    },
};

beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    });
});

function clickAt(x: number, y: number) {
    fireEvent.click(screen.getByTestId("hotspot-overlay"), {clientX: x, clientY: y});
}

describe("HotspotExercise: initial render", () => {
    it("renders the prompt and the stimulus image", () => {
        render(<HotspotExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("hotspot-prompt")).toHaveTextContent("Click the capital.");
        expect(screen.getByTestId("hotspot-image")).toBeInTheDocument();
    });

    it("surfaces the empty-state testid for a malformed payload", () => {
        const broken: ContentLessonExercise = {...EXERCISE, ext_payload: {src: "a.png"}};
        render(<HotspotExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("hotspot-empty")).toBeInTheDocument();
    });
});

describe("HotspotExercise: click-to-select + scoring", () => {
    it("disables submit until a zone is selected", () => {
        render(<HotspotExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("hotspot-submit")).toBeDisabled();
        clickAt(15, 15);
        expect(screen.getByTestId("hotspot-submit")).toBeEnabled();
    });

    it("a click outside every zone selects nothing", () => {
        render(<HotspotExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        clickAt(50, 50);
        expect(screen.getByTestId("hotspot-submit")).toBeDisabled();
    });

    it("a click on a zone's edge is inclusive", () => {
        render(<HotspotExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        clickAt(10, 10);
        expect(screen.getByTestId("hotspot-submit")).toBeEnabled();
    });

    it("reports {correct: 1, total: 1} for the correct zone", () => {
        const onComplete = vi.fn();
        render(<HotspotExercise exercise={EXERCISE} onComplete={onComplete} />);
        clickAt(15, 15);
        fireEvent.click(screen.getByTestId("hotspot-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({
                correct: 1,
                total: 1,
                raw_answer: {kind: "al_hotspot", selected_zone: 0},
            }),
        );
        expect(screen.getByTestId("hotspot-result")).toHaveAttribute("data-result", "correct");
    });

    it("reports {correct: 0, total: 1} for a distractor zone", () => {
        const onComplete = vi.fn();
        render(<HotspotExercise exercise={EXERCISE} onComplete={onComplete} />);
        clickAt(70, 70);
        fireEvent.click(screen.getByTestId("hotspot-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
        expect(screen.getByTestId("hotspot-result")).toHaveAttribute("data-result", "wrong");
    });

    it("try-again clears the selection", () => {
        render(<HotspotExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        clickAt(15, 15);
        fireEvent.click(screen.getByTestId("hotspot-submit"));
        fireEvent.click(screen.getByTestId("hotspot-retry"));
        expect(screen.getByTestId("hotspot-submit")).toBeDisabled();
    });
});

describe("HotspotExercise: reviewed (revisited, locked) reconstruction", () => {
    it("restores the exact selection and shows the locked result", () => {
        render(
            <HotspotExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{kind: "al_hotspot", selected_zone: 0}}
            />,
        );
        expect(screen.getByTestId("hotspot-result")).toHaveAttribute("data-result", "correct");
    });
});
