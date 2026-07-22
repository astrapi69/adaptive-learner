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
import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter, useLocation} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";

import {setLessonShortcutsEnabled} from "../../../lib/lesson/lessonShortcutsPref";

const reducedMotionMock = vi.fn(() => false);
vi.mock("../../../lib/feedback/feedbackPref", () => ({
    prefersReducedMotion: () => reducedMotionMock(),
}));

import NextStepSuggestions from "./NextStepSuggestions";
import type {NextStepSuggestions as Suggestions} from "../../../hooks/learning/useNextStepSuggestions";

function makeSuggestions(
    overrides: Partial<Suggestions> = {},
): Suggestions {
    return {
        loading: false,
        nextLesson: {available: false, isPaused: false},
        errorReplay: {available: false, errorCount: 0, correctedCount: 0, allCorrected: false},
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
    setId = "fr-a1",
) {
    return render(
        <MemoryRouter>
            <NextStepSuggestions
                suggestions={suggestions}
                setId={setId}
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
    setLessonShortcutsEnabled(true);
});

/** Render the card inside a router that reports the current path, so a
 *  test can assert whether an Enter keystroke navigated (and to where).
 *  Returns a getter for the live path. */
function renderWithLocation(
    suggestions: Suggestions,
    errorReplay?: ErrorReplayPayload,
): () => string {
    let path = "/summary";
    function Probe() {
        path = useLocation().pathname;
        return null;
    }
    render(
        <MemoryRouter initialEntries={["/summary"]}>
            <NextStepSuggestions
                suggestions={suggestions}
                setId="fr-a1"
                setSlug="bundled:adaptive-learner-content"
                lessonFilename="03-ser-estar.json"
                errorReplay={errorReplay}
            />
            <Probe />
        </MemoryRouter>,
    );
    return () => path;
}

describe("NextStepSuggestions Enter shortcut (#1943)", () => {
    it("Enter activates the primary next-lesson CTA without a prior click", () => {
        const path = renderWithLocation(
            makeSuggestions({
                nextLesson: {
                    available: true,
                    lessonFilename: "04-family.json",
                    title: "Family",
                    isPaused: false,
                },
                primaryAction: "next",
            }),
        );
        expect(path()).toBe("/summary");
        fireEvent.keyDown(window, {key: "Enter"});
        expect(path()).toBe(
            "/lesson/bundled:adaptive-learner-content/fr-a1/04-family.json",
        );
    });

    it("Enter picks the PRIMARY card, not a secondary one", () => {
        const path = renderWithLocation(
            makeSuggestions({
                nextLesson: {
                    available: true,
                    lessonFilename: "04-family.json",
                    title: "Family",
                    isPaused: false,
                },
                // A secondary review ("Wiederholung") card is also present.
                reviewSession: {available: true, dueCount: 5},
                primaryAction: "next",
            }),
        );
        fireEvent.keyDown(window, {key: "Enter"});
        // The next-lesson route, NOT /review/... .
        expect(path()).toBe(
            "/lesson/bundled:adaptive-learner-content/fr-a1/04-family.json",
        );
    });

    it("last lesson without a next card: Enter does nothing, no error", () => {
        const path = renderWithLocation(
            makeSuggestions({
                nextLesson: {available: false, isPaused: false},
                setComplete: true,
                setTitle: "Spanish A1",
                lessonCount: 5,
                primaryAction: "next",
            }),
        );
        // The set-complete card renders, but its "View Set" CTA is not primary.
        expect(screen.getByTestId("next-step-card-complete")).toBeInTheDocument();
        fireEvent.keyDown(window, {key: "Enter"});
        expect(path()).toBe("/summary");
    });

    it("does nothing when the Enter shortcut preference is disabled", () => {
        setLessonShortcutsEnabled(false);
        const path = renderWithLocation(
            makeSuggestions({
                nextLesson: {
                    available: true,
                    lessonFilename: "04-family.json",
                    title: "Family",
                    isPaused: false,
                },
                primaryAction: "next",
            }),
        );
        fireEvent.keyDown(window, {key: "Enter"});
        expect(path()).toBe("/summary");
    });
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

    it("set-complete 'View Set' links to the COMPLETED set's detail (#1370)", () => {
        // Even with a "How about …" suggestion for a *different* set, the
        // "View Set" CTA opens the just-completed set's detail page, not the
        // generic Discover overview and not the suggested set.
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
            "/content/set/fr-a1",
        );
    });

    it("'View Set' uses the set-id from the completed-lesson context (#1370)", () => {
        renderCard(
            makeSuggestions({
                setComplete: true,
                setTitle: "Python Grundlagen",
                lessonCount: 3,
            }),
            undefined,
            "de/python-basics",
        );
        expect(screen.getByTestId("next-step-cta-view-set")).toHaveAttribute(
            "href",
            "/content/set/de%2Fpython-basics",
        );
    });

    it("'View Set' is shown even without a suggested set (#1370)", () => {
        // The CTA is about the completed set, so it no longer depends on the
        // optional "How about …" next-set suggestion.
        renderCard(
            makeSuggestions({
                setComplete: true,
                setTitle: "French A1",
                lessonCount: 5,
            }),
        );
        const cta = screen.getByTestId("next-step-cta-view-set");
        expect(cta).toHaveAttribute("href", "/content/set/fr-a1");
        // No suggestion text when there is no suggested set.
        expect(
            screen.getByTestId("next-step-card-complete"),
        ).not.toHaveTextContent("How about");
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
                errorReplay: {available: true, errorCount: 3, correctedCount: 0, allCorrected: false},
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

    it("shows the corrected progress on the replay card (#1372)", () => {
        // 2 still open, 3 already corrected in a replay → "3 of 5 corrected".
        renderCard(
            makeSuggestions({
                errorReplay: {
                    available: true,
                    errorCount: 2,
                    correctedCount: 3,
                    allCorrected: false,
                },
            }),
            PAYLOAD,
        );
        expect(screen.getByTestId("next-step-card-error-replay")).toBeInTheDocument();
        const corrected = screen.getByTestId(
            "next-step-error-replay-corrected",
        );
        expect(corrected.textContent).toMatch(/3/);
        expect(corrected.textContent).toMatch(/5/);
    });

    it("all corrected: replaces the replay card with a success card (#1372)", () => {
        renderCard(
            makeSuggestions({
                errorReplay: {
                    available: false,
                    errorCount: 0,
                    correctedCount: 4,
                    allCorrected: true,
                },
            }),
            // no payload — nothing left to replay
        );
        expect(
            screen.queryByTestId("next-step-card-error-replay"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId("next-step-card-all-corrected"),
        ).toBeInTheDocument();
    });

    it("hides the error-replay card when there's no payload (no errors)", () => {
        renderCard(
            makeSuggestions({
                errorReplay: {available: true, errorCount: 3, correctedCount: 0, allCorrected: false},
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
                errorReplay: {available: false, errorCount: 0, correctedCount: 0, allCorrected: false},
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
                errorReplay: {available: true, errorCount: 2, correctedCount: 0, allCorrected: false},
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
