/**
 * Tests for the Lesson Creator wizard — Step 1 / metadata
 * (Phase 65A / EXP-021).
 *
 * Pins: renders step 1, required-title validation, same-language
 * validation, advance to step 2, and the cancel/discard flow.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
    ...(await orig<typeof import("react-router-dom")>()),
    useNavigate: () => navigateMock,
}));

import CreateLesson from "./CreateLesson";

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/create-lesson"]}>
            <CreateLesson />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    navigateMock.mockReset();
    localStorage.clear();
});

describe("CreateLesson — metadata step", () => {
    it("renders step 1 with the step indicator", () => {
        renderPage();
        expect(screen.getByTestId("create-lesson-page")).toBeInTheDocument();
        expect(screen.getByTestId("create-lesson-step-1")).toBeInTheDocument();
        expect(
            screen.getByTestId("create-lesson-step-indicator").textContent,
        ).toContain("1");
    });

    it("blocks Next when the title is empty", () => {
        renderPage();
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("create-lesson-title-error"),
        ).toBeInTheDocument();
        // Still on step 1.
        expect(screen.getByTestId("create-lesson-step-1")).toBeInTheDocument();
        expect(
            screen.queryByTestId("create-lesson-step-2"),
        ).not.toBeInTheDocument();
    });

    it("blocks Next when source and target language match", () => {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "My French Basics"},
        });
        // Force target == source.
        const source = (
            screen.getByTestId("create-lesson-source-lang") as HTMLSelectElement
        ).value;
        fireEvent.change(screen.getByTestId("create-lesson-target-lang"), {
            target: {value: source},
        });
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("create-lesson-same-language-error"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("create-lesson-step-1")).toBeInTheDocument();
    });

    it("advances to step 2 when metadata is valid", () => {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "My French Basics"},
        });
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(screen.getByTestId("create-lesson-step-2")).toBeInTheDocument();
        expect(screen.getByTestId("create-lesson-back")).toBeInTheDocument();
    });

    it("cancels straight to /content when nothing is entered", () => {
        renderPage();
        fireEvent.click(screen.getByTestId("create-lesson-cancel"));
        expect(navigateMock).toHaveBeenCalledWith("/content");
        expect(
            screen.queryByTestId("create-lesson-cancel-confirm"),
        ).not.toBeInTheDocument();
    });

    it("confirms before discarding a dirty lesson", () => {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "Work in progress"},
        });
        fireEvent.click(screen.getByTestId("create-lesson-cancel"));
        // Confirm dialog, not an immediate navigation.
        expect(
            screen.getByTestId("create-lesson-cancel-confirm"),
        ).toBeInTheDocument();
        expect(navigateMock).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId("create-lesson-cancel-discard"));
        expect(navigateMock).toHaveBeenCalledWith("/content");
    });
});

describe("CreateLesson — card step gate + draft", () => {
    function toStep2() {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "My French Basics"},
        });
        fireEvent.click(screen.getByTestId("create-lesson-next"));
    }

    function addCard(front: string, back: string) {
        fireEvent.change(screen.getByTestId("card-front-input"), {
            target: {value: front},
        });
        fireEvent.change(screen.getByTestId("card-back-input"), {
            target: {value: back},
        });
        fireEvent.click(screen.getByTestId("card-add-button"));
    }

    it("blocks step 3 until at least 4 cards exist", () => {
        toStep2();
        expect(screen.getByTestId("create-lesson-step-2")).toBeInTheDocument();
        // 0 cards → Next blocked.
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("create-lesson-card-error"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("create-lesson-step-2")).toBeInTheDocument();
        // Add 4 cards → Next advances to step 3.
        addCard("Bonjour", "Hallo");
        addCard("Merci", "Danke");
        addCard("Oui", "Ja");
        addCard("Non", "Nein");
        expect(screen.getByTestId("card-count").textContent).toContain("4");
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(screen.getByTestId("create-lesson-step-3")).toBeInTheDocument();
    });

    it("offers to restore a saved draft and continues it", () => {
        localStorage.setItem(
            "adaptive-learner.lesson-draft",
            JSON.stringify({
                schema: 1,
                step: 1,
                meta: {
                    title: "Saved draft lesson",
                    titleNative: "",
                    sourceLanguage: "de",
                    targetLanguage: "fr",
                    level: "A1",
                    description: "",
                    author: "",
                },
                cards: [],
                updatedAt: "2026-06-01T00:00:00Z",
            }),
        );
        renderPage();
        expect(
            screen.getByTestId("create-lesson-draft-prompt"),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("create-lesson-draft-continue"));
        expect(
            (screen.getByTestId("create-lesson-title") as HTMLInputElement)
                .value,
        ).toBe("Saved draft lesson");
    });
});
