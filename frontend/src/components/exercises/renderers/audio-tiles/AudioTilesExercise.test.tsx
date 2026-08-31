/**
 * Tests for the ext:al-audio-tiles renderer (engine#68 idea 2): a spoken
 * source-language sentence, built up as a target-language translation from
 * word tiles. Reuses the app's word-tiles editor/DnD machinery, fed from
 * ``ext_payload.tiles`` instead of the core ``exercise.tiles`` field.
 *
 * Pins that the shared audio player is mounted with the payload's audio
 * path, the tap-to-place scoring contract (mirroring WordTilesExercise's own
 * pins), the empty/malformed-payload fallback, and the reviewed (locked)
 * reconstruction.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

vi.mock("../../shared/ListenFirstAudio", () => ({
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

import AudioTilesExercise from "./AudioTilesExercise";
import type {ContentLessonExercise} from "../../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-audio-tiles-01",
    type: "ext:al-audio-tiles",
    prompt: "Listen, then build the translation.",
    card_ids: [],
    distractors: [],
    ext_payload: {
        audio: "assets/audio/je-suis-ici.mp3",
        tiles: ["Je", "suis", "ici"],
    },
} as unknown as ContentLessonExercise;

const EXERCISE_WITH_ALT: ContentLessonExercise = {
    ...EXERCISE,
    id: "ex-audio-tiles-alt",
    ext_payload: {
        audio: "assets/audio/je-suis-ici.mp3",
        tiles: ["Je", "suis", "ici"],
        accept_orderings: [[0, 2, 1]],
    },
} as unknown as ContentLessonExercise;

const place = (...indices: number[]) =>
    indices.forEach((i) => fireEvent.click(screen.getByTestId(`word-tile-scrambled-${i}`)));
const submit = () => fireEvent.click(screen.getByTestId("word-tiles-submit"));

describe("AudioTilesExercise: render", () => {
    it("renders the prompt and mounts the audio player with the payload path", () => {
        render(<AudioTilesExercise exercise={EXERCISE} setId="set-1" source="own/repo" onComplete={vi.fn()} />);
        expect(screen.getByTestId("audio-tiles-prompt")).toHaveTextContent("Listen, then build");
        const audio = screen.getByTestId("listen-first-stub");
        expect(audio).toHaveAttribute("data-audio", "assets/audio/je-suis-ici.mp3");
        expect(audio).toHaveAttribute("data-source", "own/repo");
        expect(audio).toHaveAttribute("data-set", "set-1");
    });

    it("renders every tile in the scrambled bank", () => {
        render(<AudioTilesExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("word-tile-scrambled-0")).toBeInTheDocument();
        expect(screen.getByTestId("word-tile-scrambled-1")).toBeInTheDocument();
        expect(screen.getByTestId("word-tile-scrambled-2")).toBeInTheDocument();
    });

    it("renders the empty state for a malformed payload", () => {
        const broken = {...EXERCISE, ext_payload: {audio: "a.mp3"}} as unknown as ContentLessonExercise;
        render(<AudioTilesExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("audio-tiles-empty")).toBeInTheDocument();
    });

    it("cannot check before every tile is placed", () => {
        render(<AudioTilesExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("word-tiles-submit")).toBeDisabled();
    });
});

describe("AudioTilesExercise: grading (reuses word-tiles ordering rules)", () => {
    it("grades correct when the placed order matches the canonical tile order", () => {
        const onComplete = vi.fn();
        render(<AudioTilesExercise exercise={EXERCISE} setId="set-1" lessonId="lesson-1" onComplete={onComplete} />);
        place(0, 1, 2);
        submit();
        expect(screen.getByTestId("word-tiles-result")).toHaveAttribute("data-result", "correct");
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({
                correct: 1,
                total: 1,
                raw_answer: {kind: "al_audio_tiles", placed: [0, 1, 2]},
            }),
        );
    });

    it("grades wrong when the placed order does not match", () => {
        render(<AudioTilesExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        place(1, 0, 2);
        submit();
        expect(screen.getByTestId("word-tiles-result")).toHaveAttribute("data-result", "wrong");
    });

    it("accepts an authored accept_orderings permutation", () => {
        render(<AudioTilesExercise exercise={EXERCISE_WITH_ALT} onComplete={vi.fn()} />);
        place(0, 2, 1);
        submit();
        expect(screen.getByTestId("word-tiles-result")).toHaveAttribute("data-result", "correct");
    });

    it("try-again resets the placed tiles", () => {
        render(<AudioTilesExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        place(1, 0, 2);
        submit();
        fireEvent.click(screen.getByTestId("word-tiles-retry"));
        expect(screen.getByTestId("word-tile-scrambled-0")).toBeInTheDocument();
        expect(screen.getByTestId("word-tiles-submit")).toBeDisabled();
    });
});

describe("AudioTilesExercise: reviewed reconstruction", () => {
    it("locks to the reviewed placement + verdict", () => {
        render(
            <AudioTilesExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{kind: "al_audio_tiles", placed: [0, 1, 2]}}
            />,
        );
        expect(screen.getByTestId("word-tiles-result")).toHaveAttribute("data-result", "correct");
    });
});
