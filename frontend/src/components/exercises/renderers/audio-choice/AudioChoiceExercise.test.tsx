/**
 * Tests for the ext:al-audio-choice renderer (engine#68 idea 1): a gapped
 * sentence with N audio-only options, one of which fills the gap.
 *
 * Pins the exactly-one-correct grading contract, that a tile click both
 * selects and plays (asset resolution stubbed), the empty/malformed-payload
 * fallback, and the reviewed (locked) reconstruction.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

interface UseAssetStub {
    url: string | null;
    loading: boolean;
    error: boolean;
}
const useAssetMock = vi.fn<() => UseAssetStub>(() => ({
    url: null,
    loading: false,
    error: true,
}));
vi.mock("../../../../hooks/ui/useAsset", () => ({
    useAsset: () => useAssetMock(),
}));

import AudioChoiceExercise from "./AudioChoiceExercise";
import type {ContentLessonExercise} from "../../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-audio-choice-01",
    type: "ext:al-audio-choice",
    prompt: "Pick the word that fills the gap.",
    card_ids: [],
    distractors: [],
    ext_payload: {
        sentence: "Je ___ ici.",
        options: [
            {audio: "assets/audio/suis.mp3", is_correct: "true"},
            {audio: "assets/audio/es.mp3"},
            {audio: "assets/audio/sommes.mp3"},
        ],
    },
} as unknown as ContentLessonExercise;

const submit = () => fireEvent.click(screen.getByTestId("audio-choice-submit"));

describe("AudioChoiceExercise: render", () => {
    it("renders the prompt, the sentence, and one tile per option", () => {
        render(<AudioChoiceExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("audio-choice-prompt")).toHaveTextContent(
            "Pick the word",
        );
        expect(screen.getByTestId("audio-choice-sentence")).toHaveTextContent("Je ___ ici.");
        expect(screen.getByTestId("audio-choice-option-0")).toBeInTheDocument();
        expect(screen.getByTestId("audio-choice-option-1")).toBeInTheDocument();
        expect(screen.getByTestId("audio-choice-option-2")).toBeInTheDocument();
    });

    it("renders the empty state for a malformed payload", () => {
        const broken = {...EXERCISE, ext_payload: {sentence: "x"}} as unknown as ContentLessonExercise;
        render(<AudioChoiceExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("audio-choice-empty")).toBeInTheDocument();
    });

    it("cannot check before an option is selected", () => {
        render(<AudioChoiceExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("audio-choice-submit")).toBeDisabled();
    });
});

describe("AudioChoiceExercise: grading (exactly-one-correct)", () => {
    it("tapping the correct option's tile selects it and grades correct on submit", () => {
        const onComplete = vi.fn();
        render(<AudioChoiceExercise exercise={EXERCISE} onComplete={onComplete} />);
        fireEvent.click(screen.getByTestId("audio-choice-option-0"));
        expect(screen.getByTestId("audio-choice-option-0")).toHaveAttribute("aria-pressed", "true");
        submit();
        expect(screen.getByTestId("audio-choice-result")).toHaveAttribute("data-result", "correct");
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({
                correct: 1,
                total: 1,
                raw_answer: {kind: "al_audio_choice", selected_audio: "assets/audio/suis.mp3"},
            }),
        );
    });

    it("tapping a wrong option's tile grades wrong on submit", () => {
        const onComplete = vi.fn();
        render(<AudioChoiceExercise exercise={EXERCISE} onComplete={onComplete} />);
        fireEvent.click(screen.getByTestId("audio-choice-option-1"));
        submit();
        expect(screen.getByTestId("audio-choice-result")).toHaveAttribute("data-result", "wrong");
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
    });

    it("switching the tap to a different tile changes the selection", () => {
        render(<AudioChoiceExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByTestId("audio-choice-option-1"));
        fireEvent.click(screen.getByTestId("audio-choice-option-0"));
        expect(screen.getByTestId("audio-choice-option-0")).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTestId("audio-choice-option-1")).toHaveAttribute("aria-pressed", "false");
    });

    it("marks the correct tile after submit even when the wrong one was chosen", () => {
        render(<AudioChoiceExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByTestId("audio-choice-option-1"));
        submit();
        expect(screen.getByTestId("audio-choice-option-0")).toHaveAttribute("data-correct", "true");
        expect(screen.getByTestId("audio-choice-option-1")).not.toHaveAttribute("data-correct");
    });
});

describe("AudioChoiceExercise: reviewed reconstruction", () => {
    it("locks to the reviewed selection + verdict", () => {
        render(
            <AudioChoiceExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{kind: "al_audio_choice", selected_audio: "assets/audio/suis.mp3"}}
            />,
        );
        expect(screen.getByTestId("audio-choice-option-0")).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTestId("audio-choice-result")).toHaveAttribute("data-result", "correct");
    });
});
