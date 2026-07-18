/**
 * Integration pin (#1798): the "have the AI check" control appears on a
 * WRONG free-text answer and never changes the exercise result. The AI
 * infrastructure is not exercised here (a keyless environment renders the
 * greyed BYOK button) — the verdict path is covered by
 * ``AiVerifyAnswer.test.tsx``. Here we only pin the wiring: the button shows
 * after a wrong submit, is absent on a correct one, and the recorded result
 * stays wrong.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const keyStatus = vi.fn();
vi.mock("../../../hooks/settings/useApiKeyStatus", () => ({
    useApiKeyStatus: () => keyStatus(),
}));

import FreeTextExercise from "./FreeTextExercise";
import type {ContentLessonExercise} from "../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-free-text",
    type: "free_text",
    prompt: "Translate: single",
    card_ids: [],
    accept: ["Single"],
    distractors: [],
};

function renderExercise(onComplete = vi.fn()) {
    return render(
        <MemoryRouter>
            <FreeTextExercise exercise={EXERCISE} onComplete={onComplete} />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    keyStatus.mockReset();
    // Keyless: the AI-verify control still renders (greyed BYOK button),
    // which is enough to pin that it is wired to the wrong-answer branch.
    keyStatus.mockReturnValue({ready: true, hasKey: false});
});

describe("FreeText × AiVerifyAnswer (#1798)", () => {
    it("offers the AI re-check on a wrong answer without changing the result", () => {
        const onComplete = vi.fn();
        renderExercise(onComplete);
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "noch Single"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));

        // Graded wrong…
        expect(screen.getByTestId("free-text-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
        // …and the AI re-check control is offered (greyed, keyless env).
        expect(screen.getByTestId("ai-verify-disabled")).toBeInTheDocument();
    });

    it("does not offer the AI re-check on a correct answer", () => {
        renderExercise();
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "Single"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));

        expect(screen.getByTestId("free-text-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
        expect(screen.queryByTestId("ai-verify-disabled")).toBeNull();
        expect(screen.queryByTestId("ai-verify-button")).toBeNull();
    });
});
