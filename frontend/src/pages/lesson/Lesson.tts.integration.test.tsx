/**
 * Lesson read-aloud integration (TTS C2) — page level.
 *
 * Renders the REAL Lesson page (real ExerciseDispatcher + real
 * exercise renderers; only useLesson + getStorage + speechSynthesis
 * are mocked) at each exercise step and asserts the prompt read-aloud
 * button is wired through for every exercise type — and suppressed for
 * a code exercise. This complements the per-renderer unit tests by
 * pinning that the lesson page actually threads ttsLang + codeMode to
 * the renderers.
 */

import {render, screen} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const useLessonMock = vi.fn();
const listLessonsMock = vi.fn();

vi.mock("../../hooks/lesson/session/useLesson", () => ({
    useLesson: () => useLessonMock(),
}));

vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            listSets: vi.fn(),
            downloadSet: vi.fn(),
            listLessons: listLessonsMock,
            getLesson: vi.fn(),
        },
    }),
}));

import LessonPage from "./Lesson";
import type {ContentLessonExercise} from "../../storage/types";

class FakeUtterance {
    text: string;
    lang = "";
    rate = 1;
    pitch = 1;
    voice: SpeechSynthesisVoice | null = null;
    constructor(text: string) {
        this.text = text;
    }
}

function setMockSynth(): void {
    (window as unknown as {speechSynthesis: SpeechSynthesis}).speechSynthesis =
        {
            getVoices: () => [],
            speak: vi.fn(),
            cancel: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
            speaking: false,
            pending: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        } as unknown as SpeechSynthesis;
    (
        globalThis as unknown as {SpeechSynthesisUtterance: unknown}
    ).SpeechSynthesisUtterance = FakeUtterance;
    (
        window as unknown as {SpeechSynthesisUtterance: unknown}
    ).SpeechSynthesisUtterance = FakeUtterance;
}

const EXERCISES: Record<string, ContentLessonExercise> = {
    matching: {
        id: "ex-m",
        type: "matching",
        prompt: "Match the words.",
        card_ids: [],
        pairs: [{left: "uno", right: "one"}],
        distractors: [],
    },
    picture_choice: {
        id: "ex-p",
        type: "picture_choice",
        prompt: "Pick the cat.",
        card_ids: [],
        images: [
            {src: "a.svg", label: "Cat", is_correct: "true"},
            {src: "b.svg", label: "Dog"},
        ],
        distractors: [],
    },
    free_text: {
        id: "ex-f",
        type: "free_text",
        prompt: "Translate hello.",
        card_ids: [],
        accept: ["hola"],
        distractors: [],
    },
    word_tiles: {
        id: "ex-w",
        type: "word_tiles",
        prompt: "Order the words.",
        card_ids: [],
        tiles: ["yo", "hablo"],
        distractors: [],
    },
    cloze: {
        id: "ex-c",
        type: "cloze",
        prompt: "Fill the blank.",
        card_ids: [],
        sentence: "Yo ___ aquí.",
        blanks: [{accept: ["estoy"]}],
        cloze_mode: "type",
        distractors: [],
    },
};

const CODE_EXERCISE: ContentLessonExercise = {
    id: "ex-code",
    type: "free_text",
    prompt: "Write a print statement.",
    card_ids: ["c-code"],
    accept: ["print('hi')"],
    distractors: [],
};

const LESSON_META = {
    id: "01",
    title: "L",
    description: "",
    target_language: "es",
    source_language: "en",
    estimated_minutes: 10,
    cards: [
        {
            id: "c-code",
            front: "print",
            back: "imprime",
            tags: [],
            media_type: "code" as const,
            code_language: "python",
        },
    ],
};

const PROGRESS = {
    id: "row-1",
    user_id: "user-1",
    source: "astrapi69/adaptive-learner-content",
    set_id: "es-a1",
    lesson_filename: "01.json",
    status: "in_progress" as const,
    step_results: {},
    score_correct: 0,
    score_total: 0,
    time_spent_seconds: 0,
    started_at: "2026-05-26T00:00:00Z",
    updated_at: "2026-05-26T00:00:00Z",
    completed_at: null,
};

const PATH = "/lesson/astrapi69--adaptive-learner-content/es-a1/01.json";

function renderStep(exercise: ContentLessonExercise) {
    const lesson = {
        ...LESSON_META,
        steps: [{id: exercise.id, type: "exercise" as const, exercise}],
    };
    useLessonMock.mockReturnValue({
        status: "ready",
        lesson,
        progress: PROGRESS,
        currentStepIndex: 0,
        error: null,
        goNext: vi.fn(),
        goPrev: vi.fn(),
        goToStep: vi.fn(),
        goToStepById: vi.fn(),
        recordStepResult: vi.fn(),
        markCompleted: vi.fn(),
        refresh: vi.fn(),
    });
    render(
        <MemoryRouter initialEntries={[PATH]}>
            <Routes>
                <Route
                    path="/lesson/:setSlug/:setId/:filename"
                    element={<LessonPage />}
                />
                <Route path="/content" element={<div />} />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    localStorage.clear();
    useLessonMock.mockReset();
    listLessonsMock.mockReset();
    listLessonsMock.mockResolvedValue({
        set_id: "es-a1",
        source: "astrapi69/adaptive-learner-content",
        version: "1.0.0",
        lessons: ["01.json"],
    });
    setMockSynth();
});

describe("Lesson page threads read-aloud to every exercise type (C2)", () => {
    const testidByType: Record<string, string> = {
        matching: "read-aloud-matching-prompt",
        picture_choice: "read-aloud-picture-prompt",
        free_text: "read-aloud-free-text-prompt",
        word_tiles: "read-aloud-word-tiles-prompt",
        cloze: "read-aloud-cloze-prompt",
    };

    for (const [type, exercise] of Object.entries(EXERCISES)) {
        it(`${type}: prompt read-aloud button renders`, () => {
            renderStep(exercise);
            expect(
                screen.getByTestId(testidByType[type]),
            ).toBeInTheDocument();
        });
    }

    it("suppresses read-aloud on a code exercise", () => {
        renderStep(CODE_EXERCISE);
        expect(
            screen.queryByTestId("read-aloud-free-text-prompt"),
        ).toBeNull();
    });

    it("renders no read-aloud at all when TTS is disabled in Settings", () => {
        localStorage.setItem("adaptive-learner.voice.tts_enabled", "false");
        renderStep(EXERCISES.matching);
        expect(
            screen.queryByTestId("read-aloud-matching-prompt"),
        ).toBeNull();
        // The lesson-level controls row is also hidden.
        expect(screen.queryByTestId("lesson-tts-autoread")).toBeNull();
    });
});
