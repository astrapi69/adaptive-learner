/**
 * Lesson auto-read mode (TTS feature C3).
 *
 * With a mocked speechSynthesis + auto-read enabled, the lesson
 * engine speaks each step on display: the theory body (markdown
 * stripped) and the exercise prompt, in the lesson's target
 * language. The toggle persists. Code exercises are skipped (pinned
 * by the C2 exercise-tts suite).
 */

import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const useLessonMock = vi.fn();
const listLessonsMock = vi.fn();

vi.mock("../hooks/useLesson", () => ({
    useLesson: () => useLessonMock(),
}));

vi.mock("../storage", () => ({
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

let speakCalls: SpeechSynthesisUtterance[];

class FakeUtterance {
    text: string;
    lang = "";
    rate = 1;
    pitch = 1;
    voice: SpeechSynthesisVoice | null = null;
    onstart?: () => void;
    onend?: () => void;
    onerror?: () => void;
    onboundary?: () => void;
    constructor(text: string) {
        this.text = text;
    }
}

function setMockSynth(): void {
    speakCalls = [];
    // Augment the existing happy-dom window (do NOT replace it — the
    // Lesson page relies on window.addEventListener for its pause-on-
    // unload handler).
    (window as unknown as {speechSynthesis: SpeechSynthesis}).speechSynthesis =
        {
            getVoices: () => [],
            speak: (u: SpeechSynthesisUtterance) => speakCalls.push(u),
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

const LESSON = {
    id: "01-greetings",
    title: "Greetings",
    description: "",
    target_language: "fr",
    source_language: "en",
    estimated_minutes: 10,
    cards: [],
    steps: [
        {
            id: "intro",
            type: "theory" as const,
            title: "Intro",
            body: "# Welcome\n\nBonjour means hello.",
        },
        {
            id: "ex-1",
            type: "exercise" as const,
            exercise: {
                id: "ex-1",
                type: "free_text" as const,
                prompt: "Say hello in French.",
                card_ids: [],
                accept: ["bonjour"],
                distractors: [],
            },
        },
    ],
};

const PROGRESS = {
    id: "row-1",
    user_id: "user-1",
    source: "astrapi69/adaptive-learner-content",
    set_id: "fr-a1",
    lesson_filename: "01-greetings.json",
    status: "in_progress" as const,
    step_results: {},
    score_correct: 0,
    score_total: 0,
    time_spent_seconds: 0,
    started_at: "2026-05-26T00:00:00Z",
    updated_at: "2026-05-26T00:00:00Z",
    completed_at: null,
};

const VALID_PATH =
    "/lesson/astrapi69--adaptive-learner-content/fr-a1/01-greetings.json";

function ready(stepIndex: number) {
    useLessonMock.mockReturnValue({
        status: "ready",
        lesson: LESSON,
        progress: PROGRESS,
        currentStepIndex: stepIndex,
        error: null,
        goNext: vi.fn(),
        goPrev: vi.fn(),
        goToStep: vi.fn(),
        goToStepById: vi.fn(),
        recordStepResult: vi.fn(),
        markCompleted: vi.fn(),
        refresh: vi.fn(),
    });
}

function renderPage() {
    return render(
        <MemoryRouter initialEntries={[VALID_PATH]}>
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
        set_id: "fr-a1",
        source: "astrapi69/adaptive-learner-content",
        version: "1.0.0",
        lessons: ["01-greetings.json"],
    });
    setMockSynth();
});

describe("Lesson auto-read (C3)", () => {
    it("renders the auto-read toggle when TTS is supported", () => {
        ready(0);
        renderPage();
        expect(
            screen.getByTestId("lesson-tts-autoread"),
        ).toBeInTheDocument();
    });

    it("reads the theory body aloud on display when auto-read is on", () => {
        localStorage.setItem(
            "adaptive-learner.voice.lesson_autoread",
            "true",
        );
        ready(0);
        renderPage();
        expect(speakCalls.length).toBeGreaterThan(0);
        const utter = speakCalls[0];
        expect(utter.text).toContain("Bonjour means hello");
        // Markdown heading marker is stripped from the spoken text.
        expect(utter.text).not.toContain("#");
        // Spoken in the lesson's target language.
        expect(utter.lang).toBe("fr");
    });

    it("reads the exercise prompt aloud on an exercise step", () => {
        localStorage.setItem(
            "adaptive-learner.voice.lesson_autoread",
            "true",
        );
        ready(1);
        renderPage();
        expect(speakCalls.length).toBeGreaterThan(0);
        expect(speakCalls[0].text).toBe("Say hello in French.");
    });

    it("does NOT auto-read when the toggle is off (default)", () => {
        ready(0);
        renderPage();
        expect(speakCalls.length).toBe(0);
    });

    it("toggling auto-read flips aria-pressed and persists", () => {
        ready(0);
        renderPage();
        const toggle = screen.getByTestId("lesson-tts-autoread");
        expect(toggle.getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(toggle);
        expect(toggle.getAttribute("aria-pressed")).toBe("true");
        expect(
            localStorage.getItem("adaptive-learner.voice.lesson_autoread"),
        ).toBe("true");
    });

    // --- C4: inline speed controls ---------------------------------

    it("hides the speed control while idle (not speaking)", () => {
        ready(0);
        renderPage();
        expect(screen.queryByTestId("lesson-tts-speed")).toBeNull();
    });

    it("shows the speed control while a stream is playing", () => {
        localStorage.setItem(
            "adaptive-learner.voice.lesson_autoread",
            "true",
        );
        ready(0);
        renderPage();
        // Auto-read started on mount -> speaking -> speed control shows.
        expect(screen.getByTestId("lesson-tts-speed")).toBeInTheDocument();
        for (const s of [0.5, 0.75, 1, 1.25]) {
            expect(
                screen.getByTestId(`lesson-tts-speed-${s}`),
            ).toBeInTheDocument();
        }
    });

    it("picking a speed persists it and restarts the read at the new rate", () => {
        localStorage.setItem(
            "adaptive-learner.voice.lesson_autoread",
            "true",
        );
        ready(0);
        renderPage();
        const before = speakCalls.length;
        fireEvent.click(screen.getByTestId("lesson-tts-speed-1.25"));
        expect(
            localStorage.getItem("adaptive-learner.voice.lesson_speed"),
        ).toBe("1.25");
        // Restarted at the new rate (one extra utterance).
        expect(speakCalls.length).toBe(before + 1);
        const restarted = speakCalls[speakCalls.length - 1];
        expect(restarted.rate).toBeCloseTo(1.25);
        expect(
            screen
                .getByTestId("lesson-tts-speed-1.25")
                .getAttribute("aria-pressed"),
        ).toBe("true");
    });

    // --- C5: follow-along highlight --------------------------------

    it("shows the manual theory read-aloud button on a theory step", () => {
        ready(0);
        renderPage();
        const btn = screen.getByTestId("read-aloud-theory");
        expect(btn).toBeInTheDocument();
        expect(btn.getAttribute("data-speaking")).toBe("false");
    });

    it("clicking the theory button reads it and swaps in the follow-along view", () => {
        ready(0);
        renderPage();
        expect(screen.queryByTestId("lesson-read-along")).toBeNull();
        fireEvent.click(screen.getByTestId("read-aloud-theory"));
        expect(speakCalls.length).toBe(1);
        expect(speakCalls[0].text).toContain("Bonjour means hello");
        // The follow-along view replaces the Markdown while reading.
        const along = screen.getByTestId("lesson-read-along");
        expect(along).toBeInTheDocument();
        expect(along.textContent).toContain("Bonjour means hello");
        // The button flips to the speaking (Stop) state.
        expect(
            screen.getByTestId("read-aloud-theory").getAttribute(
                "data-speaking",
            ),
        ).toBe("true");
    });

    it("auto-read on a theory step renders the follow-along view", () => {
        localStorage.setItem(
            "adaptive-learner.voice.lesson_autoread",
            "true",
        );
        ready(0);
        renderPage();
        expect(screen.getByTestId("lesson-read-along")).toBeInTheDocument();
    });
});
