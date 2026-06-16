/**
 * Tests for ExerciseHint (#590, #624).
 *
 * Pins the three render branches driven by useExerciseHints:
 * - hints enabled + derivable → the reveal button
 * - hints disabled + derivable → a disabled "Hints are off" affordance
 *   (visible-but-unavailable, feature-state policy #335 / #624)
 * - submitted / no derivable hint → nothing
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const readHintsEnabled = vi.fn();
const readHintXpCost = vi.fn();

vi.mock("../../lib/hints/hintPref", () => ({
    readHintsEnabled: () => readHintsEnabled(),
    readHintXpCost: () => readHintXpCost(),
}));

// ExerciseHint imports storage + learner state for the reveal seam; the
// render paths under test never invoke them, but stub to keep imports light.
vi.mock("../../storage", () => ({getStorage: () => ({gamification: {}})}));

import ExerciseHint from "./ExerciseHint";
import type {ContentLessonExercise} from "../../storage/types";

const FREE_TEXT: ContentLessonExercise = {
    id: "ex-1",
    type: "free_text",
    prompt: "How do you say 'Thank you'?",
    card_ids: [],
    accept: ["Merci"],
    distractors: [],
};

// A type with no derivable hint (matching with no pairs).
const NO_HINT: ContentLessonExercise = {
    id: "ex-2",
    type: "matching",
    prompt: "Match",
    card_ids: [],
    pairs: [],
    distractors: [],
};

beforeEach(() => {
    readHintsEnabled.mockReset();
    readHintXpCost.mockReset().mockReturnValue(0);
});

describe("ExerciseHint", () => {
    it("renders the reveal button when hints are enabled", () => {
        readHintsEnabled.mockReturnValue(true);
        render(<ExerciseHint exercise={FREE_TEXT} submitted={false} />);
        expect(screen.getByTestId("exercise-hint-reveal")).toBeInTheDocument();
        expect(
            screen.queryByTestId("exercise-hint-disabled"),
        ).not.toBeInTheDocument();
    });

    it("renders a disabled affordance when hints are off (#624)", () => {
        readHintsEnabled.mockReturnValue(false);
        render(<ExerciseHint exercise={FREE_TEXT} submitted={false} />);
        const disabled = screen.getByTestId("exercise-hint-disabled");
        expect(disabled).toBeDisabled();
        expect(disabled).toHaveTextContent("Hints are off");
        expect(
            screen.queryByTestId("exercise-hint-reveal"),
        ).not.toBeInTheDocument();
    });

    it("renders nothing when hints are off but none are derivable", () => {
        readHintsEnabled.mockReturnValue(false);
        const {container} = render(
            <ExerciseHint exercise={NO_HINT} submitted={false} />,
        );
        expect(container.firstChild).toBeNull();
    });

    it("renders nothing once submitted", () => {
        readHintsEnabled.mockReturnValue(true);
        const {container} = render(
            <ExerciseHint exercise={FREE_TEXT} submitted={true} />,
        );
        expect(container.firstChild).toBeNull();
    });
});
