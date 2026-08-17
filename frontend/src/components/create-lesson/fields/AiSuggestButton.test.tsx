/**
 * Tests for AiSuggestButton + useExerciseSuggest (EXP-050 Stage 4, #2511).
 *
 * Exercises the whole browser-direct stack with the model call mocked at
 * ``aiComplete``: the button -> useExerciseSuggest -> resolveActiveAiProvider
 * -> browserDirectProvider -> the pure ``suggestDistractors`` runner. Pins the
 * BYOK affordances (greyed-but-tappable no-key state + settings link), the
 * apply-on-success path, the "gate dropped everything" empty state, and error /
 * missing-provider handling.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const keyStatus = vi.fn();
vi.mock("../../../hooks/settings/useApiKeyStatus", () => ({
    useApiKeyStatus: () => keyStatus(),
}));
vi.mock("../../../hooks/ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb?: string) => fb ?? _k, lang: "en"}),
}));
vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));
const resolveProvider = vi.fn();
vi.mock("../../../lib/ai/providers/resolve-provider", () => ({
    resolveActiveAiProvider: (...a: unknown[]) => resolveProvider(...a),
}));
const aiComplete = vi.fn();
vi.mock("../../../storage/ai/ai-providers", () => ({
    aiComplete: (...a: unknown[]) => aiComplete(...a),
}));

import AiSuggestButton from "./AiSuggestButton";
import {suggestDistractors} from "../../../lib/ai/suggest/exercise-suggest";
import type {ContentLessonExercise} from "../../../storage/types";

const MC: ContentLessonExercise = {
    id: "ex-1",
    type: "multiple_choice",
    prompt: "Translate: danke",
    card_ids: [],
    distractors: [],
    options: [{text: "danke", correct: true}],
} as ContentLessonExercise;

function renderButton(onResult = vi.fn()) {
    render(
        <MemoryRouter>
            <AiSuggestButton
                run={(provider) => suggestDistractors(MC, provider)}
                isEmpty={(words) => words.length === 0}
                onResult={onResult}
                label="Suggest wrong answers with AI"
                emptyLabel="No usable suggestions — add a wrong answer by hand."
                testId="suggest"
            />
        </MemoryRouter>,
    );
    return onResult;
}

beforeEach(() => {
    keyStatus.mockReset();
    resolveProvider.mockReset();
    aiComplete.mockReset();
    resolveProvider.mockResolvedValue({
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        apiKey: "sk-x",
    });
});

afterEach(() => vi.restoreAllMocks());

describe("AiSuggestButton (#2511)", () => {
    it("renders nothing until the key status is ready", () => {
        keyStatus.mockReturnValue({ready: false, hasKey: false});
        const {container} = render(
            <MemoryRouter>
                <AiSuggestButton
                    run={(p) => suggestDistractors(MC, p)}
                    isEmpty={(w) => w.length === 0}
                    onResult={vi.fn()}
                    label="l"
                    emptyLabel="e"
                    testId="suggest"
                />
            </MemoryRouter>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    describe("without an AI key", () => {
        beforeEach(() => keyStatus.mockReturnValue({ready: true, hasKey: false}));

        it("shows the greyed button (aria-disabled) and fires no AI call", () => {
            renderButton();
            const button = screen.getByTestId("suggest-disabled");
            expect(button).toHaveAttribute("aria-disabled", "true");
            expect(button).not.toBeDisabled();
            fireEvent.click(button);
            expect(aiComplete).not.toHaveBeenCalled();
        });

        it("offers a BYOK hint linking to the AI settings", () => {
            renderButton();
            expect(screen.getByTestId("suggest-no-key")).toBeInTheDocument();
            expect(screen.getByTestId("suggest-settings-link")).toHaveAttribute(
                "href",
                "/settings?tab=ai",
            );
        });
    });

    it("applies gated distractors on success and shows the disclaimer", async () => {
        keyStatus.mockReturnValue({ready: true, hasKey: true});
        aiComplete.mockResolvedValue('["bitte", "hallo", "tschüss", "danke"]');
        const onResult = renderButton();

        expect(screen.getByTestId("suggest-disclaimer")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("suggest-button"));

        await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
        // "danke" is the correct option — dropped; the three usable remain.
        expect(onResult).toHaveBeenCalledWith(["bitte", "hallo", "tschüss"]);
    });

    it("shows the empty message when the gate drops everything, not onResult", async () => {
        keyStatus.mockReturnValue({ready: true, hasKey: true});
        // The model returns only the correct answer — nothing usable survives.
        aiComplete.mockResolvedValue('["danke"]');
        const onResult = renderButton();

        fireEvent.click(screen.getByTestId("suggest-button"));
        await waitFor(() =>
            expect(screen.getByTestId("suggest-empty")).toBeInTheDocument(),
        );
        expect(onResult).not.toHaveBeenCalled();
    });

    it("shows an error and does not crash when the AI call fails", async () => {
        keyStatus.mockReturnValue({ready: true, hasKey: true});
        aiComplete.mockRejectedValue(new Error("HTTP 401: invalid key"));
        const onResult = renderButton();
        fireEvent.click(screen.getByTestId("suggest-button"));
        await waitFor(() =>
            expect(screen.getByTestId("suggest-error")).toHaveTextContent(
                "HTTP 401: invalid key",
            ),
        );
        expect(onResult).not.toHaveBeenCalled();
    });

    it("handles a missing resolved provider gracefully", async () => {
        keyStatus.mockReturnValue({ready: true, hasKey: true});
        resolveProvider.mockResolvedValue(null);
        const onResult = renderButton();
        fireEvent.click(screen.getByTestId("suggest-button"));
        await waitFor(() =>
            expect(screen.getByTestId("suggest-error")).toBeInTheDocument(),
        );
        expect(aiComplete).not.toHaveBeenCalled();
        expect(onResult).not.toHaveBeenCalled();
    });
});
