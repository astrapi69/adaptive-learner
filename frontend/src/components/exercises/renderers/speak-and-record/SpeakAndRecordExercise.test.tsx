/**
 * Tests for the ext:al-speak-and-record renderer (engine#68 idea 3): a
 * speaker button reads a sentence, a "show" button reveals its text, a
 * "record" button lets the learner record and play back their own voice.
 *
 * Pins: TTS fallback vs. authored-audio playback, the show toggle, that a
 * recording gets persisted through ``getStorage().speechRecordings``, the
 * ungraded ``score()`` contract (empty ``attempts``, always
 * ``correct===total``), and the reviewed (locked) reconstruction.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../shared/ListenFirstAudio", () => ({
    default: ({audioPath}: {audioPath: string | null | undefined}) => (
        <div data-testid="listen-first-stub" data-audio={audioPath ?? ""} />
    ),
}));

vi.mock("../../../voice/SpeechButton", () => ({
    default: ({text}: {text: string}) => (
        <button type="button" data-testid="speech-button-stub" data-text={text} />
    ),
}));

vi.mock("../../../voice/RecordButton", () => ({
    default: ({
        onRecorded,
    }: {
        onRecorded: (clip: {blob: Blob; mimeType: string; durationMs: number}) => void;
    }) => (
        <button
            type="button"
            data-testid="record-button-stub"
            onClick={() =>
                onRecorded({blob: new Blob(["clip"], {type: "audio/webm"}), mimeType: "audio/webm", durationMs: 1200})
            }
        />
    ),
}));

const getMock = vi.fn();
const saveMock = vi.fn();
vi.mock("../../../../storage", () => ({
    getStorage: () => ({
        speechRecordings: {
            get: (...args: unknown[]) => getMock(...args),
            save: (...args: unknown[]) => saveMock(...args),
        },
    }),
}));

import SpeakAndRecordExercise from "./SpeakAndRecordExercise";
import {setUserId} from "../../../../lib/learning/learnerState";
import type {ContentLessonExercise} from "../../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-speak-01",
    type: "ext:al-speak-and-record",
    prompt: "Listen, reveal, then record yourself.",
    card_ids: [],
    distractors: [],
    ext_payload: {sentence: "Je suis ici."},
} as unknown as ContentLessonExercise;

const WITH_AUDIO: ContentLessonExercise = {
    ...EXERCISE,
    ext_payload: {sentence: "Je suis ici.", audio: "assets/audio/je-suis-ici.mp3"},
} as unknown as ContentLessonExercise;

beforeEach(() => {
    setUserId("user-1");
    getMock.mockReset();
    saveMock.mockReset();
    getMock.mockResolvedValue(null);
    saveMock.mockResolvedValue({
        id: "row-1",
        user_id: "user-1",
        source: "",
        set_id: "set-1",
        lesson_filename: "lesson-1",
        exercise_id: "ex-speak-01",
        audio_base64: "Y2xpcA==",
        mime_type: "audio/webm",
        duration_ms: 1200,
        recorded_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    });
});

describe("SpeakAndRecordExercise: render", () => {
    it("renders the prompt and falls back to TTS when no audio is authored", () => {
        render(
            <SpeakAndRecordExercise exercise={EXERCISE} setId="set-1" lessonId="lesson-1" onComplete={vi.fn()} />,
        );
        expect(screen.getByTestId("speak-and-record-prompt")).toHaveTextContent("Listen, reveal");
        const speech = screen.getByTestId("speech-button-stub");
        expect(speech).toHaveAttribute("data-text", "Je suis ici.");
        expect(screen.queryByTestId("listen-first-stub")).not.toBeInTheDocument();
    });

    it("plays the authored reference clip via ListenFirstAudio when present", () => {
        render(
            <SpeakAndRecordExercise exercise={WITH_AUDIO} setId="set-1" lessonId="lesson-1" onComplete={vi.fn()} />,
        );
        expect(screen.getByTestId("listen-first-stub")).toHaveAttribute(
            "data-audio",
            "assets/audio/je-suis-ici.mp3",
        );
        expect(screen.queryByTestId("speech-button-stub")).not.toBeInTheDocument();
    });

    it("renders the empty state for a malformed payload", () => {
        const broken = {...EXERCISE, ext_payload: {}} as unknown as ContentLessonExercise;
        render(<SpeakAndRecordExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("speak-and-record-empty")).toBeInTheDocument();
    });

    it("hides the sentence text until Show is clicked", () => {
        render(<SpeakAndRecordExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.queryByTestId("speak-and-record-sentence")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("speak-and-record-show"));
        expect(screen.getByTestId("speak-and-record-sentence")).toHaveTextContent("Je suis ici.");
    });

    it("cannot mark done before any recording exists", () => {
        render(<SpeakAndRecordExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("speak-and-record-submit")).toBeDisabled();
    });
});

describe("SpeakAndRecordExercise: recording", () => {
    it("persists the clip through getStorage().speechRecordings.save", async () => {
        render(
            <SpeakAndRecordExercise
                exercise={EXERCISE}
                setId="set-1"
                lessonId="lesson-1"
                source="astrapi69/adaptive-learner-content"
                onComplete={vi.fn()}
            />,
        );
        await act(async () => {
            fireEvent.click(screen.getByTestId("record-button-stub"));
        });
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
        expect(saveMock).toHaveBeenCalledWith(
            "user-1",
            expect.objectContaining({
                source: "astrapi69/adaptive-learner-content",
                set_id: "set-1",
                lesson_filename: "lesson-1",
                exercise_id: "ex-speak-01",
                mime_type: "audio/webm",
                duration_ms: 1200,
            }),
        );
    });

    it("enables Done and shows playback once a clip is recorded", async () => {
        render(<SpeakAndRecordExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        await act(async () => {
            fireEvent.click(screen.getByTestId("record-button-stub"));
        });
        expect(screen.getByTestId("speak-and-record-submit")).not.toBeDisabled();
        expect(screen.getByTestId("speak-and-record-playback")).toBeInTheDocument();
    });

    it("loads a previously-saved clip on mount", async () => {
        getMock.mockResolvedValue({
            id: "row-1",
            user_id: "user-1",
            source: "",
            set_id: "set-1",
            lesson_filename: "lesson-1",
            exercise_id: "ex-speak-01",
            audio_base64: "cHJpb3I=",
            mime_type: "audio/webm",
            duration_ms: 900,
            recorded_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        });
        render(<SpeakAndRecordExercise exercise={EXERCISE} setId="set-1" lessonId="lesson-1" onComplete={vi.fn()} />);
        await waitFor(() => expect(screen.getByTestId("speak-and-record-playback")).toBeInTheDocument());
        expect(screen.getByTestId("speak-and-record-submit")).not.toBeDisabled();
    });
});

describe("SpeakAndRecordExercise: ungraded completion contract", () => {
    it("completes with an empty attempts array and correct === total", async () => {
        const onComplete = vi.fn();
        render(<SpeakAndRecordExercise exercise={EXERCISE} onComplete={onComplete} />);
        await act(async () => {
            fireEvent.click(screen.getByTestId("record-button-stub"));
        });
        fireEvent.click(screen.getByTestId("speak-and-record-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({
                correct: 1,
                total: 1,
                attempts: [],
                raw_answer: {kind: "al_speak_and_record", recorded: true},
            }),
        );
    });
});

describe("SpeakAndRecordExercise: reviewed reconstruction", () => {
    it("locks to a completed, submitted view (retry button, no submit button)", () => {
        render(
            <SpeakAndRecordExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{kind: "al_speak_and_record", recorded: true}}
            />,
        );
        expect(screen.getByTestId("speak-and-record-retry")).toBeInTheDocument();
        expect(screen.queryByTestId("speak-and-record-submit")).not.toBeInTheDocument();
    });
});
