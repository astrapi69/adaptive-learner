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
