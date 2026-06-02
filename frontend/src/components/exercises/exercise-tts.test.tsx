/**
 * Exercise read-aloud wiring (TTS feature C2).
 *
 * Each renderer surfaces a prompt-level ReadAloudButton when a
 * ``ttsLang`` is supplied (the lesson's target language), and
 * suppresses it for code/formula content (``codeMode``). The
 * Review + AdaptiveLesson pages pass no ttsLang, so they get no
 * read-aloud — pinned by the no-ttsLang case below.
 */

import {render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {I18nProvider} from "../../hooks/useI18n";
import type {ContentLessonExercise} from "../../storage/types";

import FreeTextExercise from "./FreeTextExercise";
import MatchingExercise from "./MatchingExercise";
import ClozeExercise from "./ClozeExercise";
import PictureChoiceExercise from "./PictureChoiceExercise";
import WordTilesExercise from "./WordTilesExercise";

function setMockSynth(): void {
    (globalThis as unknown as {window: typeof window}).window = {
        ...((globalThis as unknown as {window: typeof window}).window || {}),
        speechSynthesis: {
            getVoices: () => [],
            speak: vi.fn(),
            cancel: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
            speaking: false,
            pending: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        } as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: class {
            text: string;
            lang = "";
            rate = 1;
            pitch = 1;
            voice: SpeechSynthesisVoice | null = null;
            constructor(text: string) {
                this.text = text;
            }
        } as unknown as typeof SpeechSynthesisUtterance,
    } as Window & typeof globalThis;
}

const FREE_TEXT: ContentLessonExercise = {
    id: "ex-f",
    type: "free_text",
    prompt: "Translate hello.",
    card_ids: [],
    accept: ["hola"],
    distractors: [],
};

const MATCHING: ContentLessonExercise = {
    id: "ex-m",
    type: "matching",
    prompt: "Match the words.",
    card_ids: [],
    pairs: [{left: "A", right: "1"}],
    distractors: [],
};

const CLOZE: ContentLessonExercise = {
    id: "ex-c",
    type: "cloze",
    prompt: "Fill in.",
    card_ids: [],
    sentence: "Yo ___ aquí.",
    blanks: [{accept: ["estoy"]}],
    cloze_mode: "type",
    distractors: [],
};

const PICTURE: ContentLessonExercise = {
    id: "ex-p",
    type: "picture_choice",
    prompt: "Pick the cat.",
    card_ids: [],
    images: [
        {src: "a.svg", label: "Cat", is_correct: "true"},
        {src: "b.svg", label: "Dog"},
    ],
    distractors: [],
};

const WORD_TILES: ContentLessonExercise = {
    id: "ex-w",
    type: "word_tiles",
    prompt: "Order the words.",
    card_ids: [],
    tiles: ["yo", "hablo"],
    distractors: [],
};

beforeEach(() => {
    localStorage.clear();
    setMockSynth();
});

describe("exercise prompt read-aloud (C2)", () => {
    it("free_text shows the prompt speaker button when given a ttsLang", () => {
        render(
            <I18nProvider>
                <FreeTextExercise
                    exercise={FREE_TEXT}
                    ttsLang="es"
                    onComplete={vi.fn()}
                />
            </I18nProvider>,
        );
        expect(
            screen.getByTestId("read-aloud-free-text-prompt"),
        ).toBeTruthy();
    });

    it("free_text suppresses read-aloud for code content (codeMode)", () => {
        const {container} = render(
            <I18nProvider>
                <FreeTextExercise
                    exercise={FREE_TEXT}
                    ttsLang="es"
                    codeMode
                    onComplete={vi.fn()}
                />
            </I18nProvider>,
        );
        expect(
            container.querySelector(
                '[data-testid="read-aloud-free-text-prompt"]',
            ),
        ).toBeNull();
    });

    it("renders NO read-aloud when no ttsLang is supplied (Review/Adaptive)", () => {
        const {container} = render(
            <I18nProvider>
                <FreeTextExercise exercise={FREE_TEXT} onComplete={vi.fn()} />
            </I18nProvider>,
        );
        expect(
            container.querySelector(
                '[data-testid="read-aloud-free-text-prompt"]',
            ),
        ).toBeNull();
    });

    it("matching + cloze also surface a prompt speaker button with ttsLang", () => {
        const {unmount} = render(
            <I18nProvider>
                <MatchingExercise
                    exercise={MATCHING}
                    ttsLang="fr"
                    onComplete={vi.fn()}
                />
            </I18nProvider>,
        );
        expect(screen.getByTestId("read-aloud-matching-prompt")).toBeTruthy();
        unmount();
        render(
            <I18nProvider>
                <ClozeExercise
                    exercise={CLOZE}
                    ttsLang="es"
                    onComplete={vi.fn()}
                />
            </I18nProvider>,
        );
        expect(screen.getByTestId("read-aloud-cloze-prompt")).toBeTruthy();
    });

    // QA D1 — picture_choice + word_tiles were previously only covered
    // by the page integration test; pin them at the component layer too.
    it("picture_choice surfaces a prompt speaker button with ttsLang", () => {
        render(
            <I18nProvider>
                <PictureChoiceExercise
                    exercise={PICTURE}
                    ttsLang="es"
                    onComplete={vi.fn()}
                />
            </I18nProvider>,
        );
        expect(
            screen.getByTestId("read-aloud-picture-prompt"),
        ).toBeTruthy();
    });

    it("picture_choice renders NO read-aloud without a ttsLang", () => {
        const {container} = render(
            <I18nProvider>
                <PictureChoiceExercise
                    exercise={PICTURE}
                    onComplete={vi.fn()}
                />
            </I18nProvider>,
        );
        expect(
            container.querySelector(
                '[data-testid="read-aloud-picture-prompt"]',
            ),
        ).toBeNull();
    });

    it("word_tiles surfaces a prompt speaker button with ttsLang", () => {
        render(
            <I18nProvider>
                <WordTilesExercise
                    exercise={WORD_TILES}
                    ttsLang="es"
                    onComplete={vi.fn()}
                />
            </I18nProvider>,
        );
        expect(
            screen.getByTestId("read-aloud-word-tiles-prompt"),
        ).toBeTruthy();
    });

    it("word_tiles suppresses read-aloud for code content (codeMode)", () => {
        const {container} = render(
            <I18nProvider>
                <WordTilesExercise
                    exercise={WORD_TILES}
                    ttsLang="es"
                    codeMode
                    onComplete={vi.fn()}
                />
            </I18nProvider>,
        );
        expect(
            container.querySelector(
                '[data-testid="read-aloud-word-tiles-prompt"]',
            ),
        ).toBeNull();
    });
});
