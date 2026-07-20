/**
 * Tests for the ext:al-dictation renderer (#1881, fifth adoption): an audio
 * clip the learner listens to, then types the transcription.
 *
 * Pins that the shared ListenFirstAudio is mounted with the payload's audio
 * path, that the typed transcription is graded through the shared free-text
 * matcher (correct / near-miss / wrong), that the canonical solution surfaces
 * after a wrong attempt, and the reviewed (locked) reconstruction.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

// Stub the shared audio player so the test asserts it is mounted with the
// payload's audio path (its own useAsset chain is covered by ListenFirstAudio's
// own test).
vi.mock("../shared/ListenFirstAudio", () => ({
    default: ({
        audioPath,
        source,
        setId,
    }: {
        audioPath: string | null | undefined;
        source: string;
        setId: string;
    }) => (
        <div
            data-testid="listen-first-stub"
            data-audio={audioPath ?? ""}
            data-source={source}
            data-set={setId}
        />
    ),
}));

import DictationExercise from "./DictationExercise";
import type {ContentLessonExercise} from "../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-dict-01",
    type: "ext:al-dictation",
    prompt: "Listen and write what you hear.",
    card_ids: [],
    distractors: [],
    ext_payload: {
        audio: "assets/audio/bonjour.mp3",
        accept: ["Bonjour", "bonjour"],
    },
} as unknown as ContentLessonExercise;

const type = (value: string) =>
    fireEvent.change(screen.getByTestId("dictation-input"), {target: {value}});
const submit = () => fireEvent.click(screen.getByTestId("dictation-submit"));

describe("DictationExercise: render", () => {
    it("renders the prompt, the input, and mounts the audio player with the payload path", () => {
        render(<DictationExercise exercise={EXERCISE} setId="set-1" source="own/repo" onComplete={vi.fn()} />);
        expect(screen.getByTestId("dictation-prompt")).toHaveTextContent(
            "Listen and write",
        );
        expect(screen.getByTestId("dictation-input")).toBeInTheDocument();
        const audio = screen.getByTestId("listen-first-stub");
        expect(audio).toHaveAttribute("data-audio", "assets/audio/bonjour.mp3");
        expect(audio).toHaveAttribute("data-source", "own/repo");
        expect(audio).toHaveAttribute("data-set", "set-1");
    });

    it("renders the empty state for a malformed payload", () => {
        const broken = {...EXERCISE, ext_payload: {accept: ["x"]}} as unknown as ContentLessonExercise;
        render(<DictationExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("dictation-empty")).toBeInTheDocument();
    });
});

describe("DictationExercise: grading (shared free-text matcher)", () => {
    it("marks an exact transcription correct", () => {
        const onComplete = vi.fn();
        render(<DictationExercise exercise={EXERCISE} onComplete={onComplete} />);
        type("Bonjour");
        submit();
        expect(screen.getByTestId("dictation-result")).toHaveAttribute("data-result", "correct");
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1, raw_answer: {kind: "al_dictation", input: "Bonjour"}}),
        );
    });

    it("accepts a single-typo transcription (Levenshtein tolerance)", () => {
        render(<DictationExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        type("Bonjur"); // one deletion -> distance 1
        submit();
        expect(screen.getByTestId("dictation-result")).toHaveAttribute("data-result", "correct");
    });

    it("marks a near-miss wrong but shows the encouraging message + solution", () => {
        render(<DictationExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        type("Bonjxxr"); // 2 substitutions -> distance 2, wrong but near
        submit();
        expect(screen.getByTestId("dictation-result")).toHaveAttribute("data-result", "wrong");
        expect(screen.getByTestId("dictation-result")).toHaveTextContent(/Almost/i);
        expect(screen.getByTestId("dictation-solution")).toHaveTextContent("Bonjour");
    });

    it("marks a far-off answer wrong and surfaces the canonical solution", () => {
        render(<DictationExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        type("something else entirely");
        submit();
        expect(screen.getByTestId("dictation-result")).toHaveAttribute("data-result", "wrong");
        expect(screen.getByTestId("dictation-solution")).toHaveTextContent("Bonjour");
    });

    it("cannot check an empty input", () => {
        render(<DictationExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("dictation-submit")).toBeDisabled();
    });
});

describe("DictationExercise: reviewed reconstruction", () => {
    it("locks to the reviewed input + verdict", () => {
        render(
            <DictationExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{kind: "al_dictation", input: "Bonjour"}}
            />,
        );
        expect(screen.getByTestId("dictation-input")).toHaveValue("Bonjour");
        expect(screen.getByTestId("dictation-result")).toHaveAttribute("data-result", "correct");
    });
});
