/**
 * Dispatcher wiring for listen-first (#1600 Option A): when the parent
 * threads a ``listenAudioPath``, the free_text and matching renderers get
 * the audio control ABOVE the exercise; every other type (and the no-path
 * case) stays untouched.
 */

import "@testing-library/jest-dom/vitest";
import {describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";

const useAssetMock = vi.fn(() => ({
    url: "blob:audio-1",
    loading: false,
    error: false,
}));
vi.mock("../../../hooks/ui/useAsset", () => ({
    useAsset: () => useAssetMock(),
}));

import {ExerciseDispatcher} from "./ExerciseDispatcher";
import {I18nProvider} from "../../../hooks/ui/useI18n";
import type {ContentLessonCard, ContentLessonStep} from "../../../storage/types";

function audioCard(audio: string | null = "audio/coffee.mp3"): ContentLessonCard {
    return {
        id: "c1",
        front: "coffee",
        back: "der Kaffee",
        notes: null,
        image: null,
        audio,
        difficulty: null,
        tags: [],
        token_roles: null,
    } as unknown as ContentLessonCard;
}

function step(type: string, extra: Record<string, unknown> = {}): ContentLessonStep {
    return {
        id: "s1",
        type: "exercise",
        exercise: {
            id: "ex1",
            type,
            prompt: "Translate 'coffee'",
            card_ids: ["c1"],
            distractors: [],
            ...extra,
        },
    } as unknown as ContentLessonStep;
}

function renderDispatcher(s: ContentLessonStep, cards: ContentLessonCard[]) {
    return render(
        <I18nProvider>
            <ExerciseDispatcher
                step={s}
                setId="set-1"
                lessonId="lesson-1"
                source="owner/repo"
                cards={cards}
                onComplete={vi.fn()}
            />
        </I18nProvider>,
    );
}

describe("ExerciseDispatcher listen-first wiring (#1600)", () => {
    it("free_text whose card carries audio shows the audio control", () => {
        renderDispatcher(step("free_text", {accept: ["der Kaffee"]}), [audioCard()]);
        expect(screen.getByTestId("listen-first")).toBeInTheDocument();
    });

    it("matching whose card carries audio shows the audio control", () => {
        renderDispatcher(
            step("matching", {
                pairs: [
                    {left: "coffee", right: "der Kaffee"},
                    {left: "milk", right: "die Milch"},
                ],
            }),
            [audioCard()],
        );
        expect(screen.getByTestId("listen-first")).toBeInTheDocument();
    });

    it("free_text without card audio stays untouched", () => {
        renderDispatcher(step("free_text", {accept: ["der Kaffee"]}), [audioCard(null)]);
        expect(screen.queryByTestId("listen-first")).toBeNull();
    });

    it("other types ignore card audio (multiple_choice)", () => {
        renderDispatcher(
            step("multiple_choice", {
                options: [
                    {text: "a", correct: true},
                    {text: "b"},
                ],
            }),
            [audioCard()],
        );
        expect(screen.queryByTestId("listen-first")).toBeNull();
    });
});
