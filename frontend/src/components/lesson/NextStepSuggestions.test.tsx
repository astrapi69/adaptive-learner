/**
 * Tests for NextStepSuggestions (Phase 64 / smart-next-steps).
 *
 * Pins the card rendering + variants:
 *   - next-lesson card (Start) / resume variant (paused)
 *   - adaptive card gated on errors
 *   - review card gated on due items
 *   - set-complete card + suggested-set link
 *   - primary vs secondary styling driven by primaryAction
 *   - prefers-reduced-motion suppresses the animation class
 *   - loading / nothing-available → renders nothing
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";

const reducedMotionMock = vi.fn(() => false);
vi.mock("../../lib/feedback/feedbackPref", () => ({
    prefersReducedMotion: () => reducedMotionMock(),
}));

import NextStepSuggestions from "./NextStepSuggestions";
import type {NextStepSuggestions as Suggestions} from "../../hooks/useNextStepSuggestions";

function makeSuggestions(
    overrides: Partial<Suggestions> = {},
): Suggestions {
    return {
        loading: false,
        nextLesson: {available: false, isPaused: false},
        errorReplay: {available: false, errorCount: 0},
        adaptiveLesson: {available: false, focusTag: null, errorCount: 0},
        reviewSession: {available: false, dueCount: 0},
        setComplete: false,
        primaryAction: "next",
        ...overrides,
    };
}

import type {ErrorReplayPayload} from "./NextStepSuggestions";

function renderCard(
    suggestions: Suggestions,
    errorReplay?: ErrorReplayPayload,
) {
    return render(
        <MemoryRouter>
            <NextStepSuggestions
                suggestions={suggestions}
                setId="fr-a1"
                setSlug="bundled:adaptive-learner-content"
                lessonFilename="03-ser-estar.json"
                errorReplay={errorReplay}
            />
        </MemoryRouter>,
    );
}

afterEach(() => {
    reducedMotionMock.mockReset();
    reducedMotionMock.mockReturnValue(false);
});

describe("NextStepSuggestions", () => {
    it("renders nothing while loading", () => {
        const {container} = renderCard(makeSuggestions({loading: true}));
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when no suggestion is available", () => {
        const {container} = renderCard(makeSuggestions());
        expect(container).toBeEmptyDOMElement();
    });

    it("renders the next-lesson card with a Start link", () => {
        renderCard(
            makeSuggestions({
                nextLesson: {
                    available: true,
                    lessonFilename: "04.json",
                    title: "Être et Avoir",
                    isPaused: false,
                },
                primaryAction: "next",
            }),
        );
        expect(screen.getByTestId("next-step-card-next")).toBeInTheDocument();
        expect(screen.getByText("Être et Avoir")).toBeInTheDocument();
        const cta = screen.getByTestId("next-step-cta-next");
        expect(cta).toHaveAttribute(
            "href",
            "/lesson/bundled:adaptive-learner-content/fr-a1/04.json",
        );
    });

    it("renders the resume variant when the next lesson is paused", () => {
        renderCard(
            makeSuggestions({
                nextLesson: {
                    available: true,
                    lessonFilename: "04.json",
                    title: "Être et Avoir",
                    isPaused: true,
                    pausedStep: 3,
                    totalSteps: 8,
                },
            }),
        );
        expect(screen.getByTestId("next-step-card-next")).toHaveTextContent(
            "Resume",
        );
        expect(screen.getByTestId("next-step-card-next")).toHaveTextContent(
            "Step 3 of 8",
        );
    });

    it("renders the adaptive card only when errors exist", () => {
        renderCard(
            makeSuggestions({
                adaptiveLesson: {
                    available: true,
                    focusTag: "article_gender",
                    errorCount: 5,
                },
                primaryAction: "adaptive",
            }),
        );
        const card = screen.getByTestId("next-step-card-adaptive");
        expect(card).toHaveTextContent("Article gender");
        expect(card).toHaveTextContent("5 errors in this lesson");
        expect(screen.getByTestId("next-step-cta-adaptive")).toHaveAttribute(
            "href",
            "/adaptive-lesson/fr-a1",
        );
    });

    it("does not render the adaptive card when unavailable", () => {
        renderCard(
            makeSuggestions({
                nextLesson: {available: true, isPaused: false, title: "x"},
            }),
        );
        expect(
            screen.queryByTestId("next-step-card-adaptive"),
        ).not.toBeInTheDocument();
    });

    it("renders the review card only when items are due", () => {
        renderCard(
            makeSuggestions({
                reviewSession: {available: true, dueCount: 12},
                primaryAction: "review",
            }),
        );
        const card = screen.getByTestId("next-step-card-review");
        expect(card).toHaveTextContent("12 elements due");
        expect(screen.getByTestId("next-step-cta-review")).toHaveAttribute(
            "href",
            "/review/fr-a1",
        );
    });

    it("renders the set-complete card with a suggested set link", () => {
        renderCard(
            makeSuggestions({
                setComplete: true,
                setTitle: "French A1",
                lessonCount: 5,
                suggestedSet: {setId: "es-a1", title: "Spanish A1"},
            }),
        );
        const card = screen.getByTestId("next-step-card-complete");
        expect(card).toHaveTextContent(
            "All 5 lessons in French A1 completed!",
        );
        expect(card).toHaveTextContent("Spanish A1");
        expect(screen.getByTestId("next-step-cta-view-set")).toHaveAttribute(
            "href",
            "/content",
        );
    });

    it("marks the primary card and leaves others secondary", () => {
        renderCard(
            makeSuggestions({
                nextLesson: {available: true, isPaused: false, title: "x"},
                adaptiveLesson: {
                    available: true,
                    focusTag: null,
                    errorCount: 2,
                },
                primaryAction: "next",
            }),
        );
        const next = screen.getByTestId("next-step-card-next");
        const adaptive = screen.getByTestId("next-step-card-adaptive");
        expect(next).toHaveAttribute("data-primary", "true");
        expect(next.className).toContain("is-primary");
        expect(adaptive).toHaveAttribute("data-primary", "false");
        expect(adaptive.className).toContain("is-secondary");
    });

    it("applies the animation class by default", () => {
        renderCard(
            makeSuggestions({
                nextLesson: {available: true, isPaused: false, title: "x"},
            }),
        );
        expect(
            screen.getByTestId("next-step-card-next").className,
        ).toContain("is-animated");
    });

    it("suppresses the animation class under prefers-reduced-motion", () => {
        reducedMotionMock.mockReturnValue(true);
        renderCard(
            makeSuggestions({
                nextLesson: {available: true, isPaused: false, title: "x"},
            }),
        );
        const card = screen.getByTestId("next-step-card-next");
        expect(card.className).not.toContain("is-animated");
        expect(card.getAttribute("style")).toBeFalsy();
    });

    // --- error-replay card ----------------------------------------

    const PAYLOAD = {
        exercises: [
            {
                id: "ex-a",
                type: "free_text" as const,
                prompt: "p",
                card_ids: [],
                accept: ["x"],
                distractors: [],
            },
        ],
        cards: [],
        lessonTitle: "Ser/Estar",
    };

    it("shows the error-replay card when available + a payload is given", () => {
        renderCard(
            makeSuggestions({
                errorReplay: {available: true, errorCount: 3},
            }),
            PAYLOAD,
        );
        const card = screen.getByTestId("next-step-card-error-replay");
        expect(card).toBeInTheDocument();
        // "{count} exercises again"
        expect(card.textContent).toMatch(/3/);
        // Links to the error-replay route.
        const cta = screen.getByTestId("next-step-cta-error-replay");
        expect(cta.getAttribute("href")).toContain(
            "/error-replay/bundled:adaptive-learner-content/fr-a1/03-ser-estar.json",
        );
    });

    it("hides the error-replay card when there's no payload (no errors)", () => {
        renderCard(
            makeSuggestions({
                errorReplay: {available: true, errorCount: 3},
            }),
            // no payload
        );
        expect(
            screen.queryByTestId("next-step-card-error-replay"),
        ).not.toBeInTheDocument();
    });

    it("hides the error-replay card when not available (clean run)", () => {
        renderCard(
            makeSuggestions({
                nextLesson: {available: true, isPaused: false, title: "x"},
                errorReplay: {available: false, errorCount: 0},
            }),
            PAYLOAD,
        );
        expect(
            screen.queryByTestId("next-step-card-error-replay"),
        ).not.toBeInTheDocument();
    });

    it("marks error-replay primary when primaryAction is error_replay", () => {
        renderCard(
            makeSuggestions({
                nextLesson: {available: true, isPaused: false, title: "x"},
                errorReplay: {available: true, errorCount: 2},
                primaryAction: "error_replay",
            }),
            PAYLOAD,
        );
        const card = screen.getByTestId("next-step-card-error-replay");
        expect(card.getAttribute("data-primary")).toBe("true");
        // The next card is demoted to secondary.
        expect(
            screen.getByTestId("next-step-card-next").getAttribute("data-primary"),
        ).toBe("false");
    });
});
