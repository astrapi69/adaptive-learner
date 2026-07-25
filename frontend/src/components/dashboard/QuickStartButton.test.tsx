import {render, screen, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import QuickStartButton from "./QuickStartButton";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
    const actual = await vi.importActual<typeof import("react-router")>(
        "react-router",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

describe("QuickStartButton", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders without a method badge when no suggestion is provided", () => {
        render(
            <MemoryRouter>
                <QuickStartButton suggestedMethod={null} />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("quick-start")).toBeInTheDocument();
        expect(screen.queryByTestId("quick-start-method")).not.toBeInTheDocument();
    });

    it("renders the method badge when a suggestion is provided", () => {
        render(
            <MemoryRouter>
                <QuickStartButton suggestedMethod="dialogic" />
            </MemoryRouter>,
        );
        const badge = screen.getByTestId("quick-start-method");
        expect(badge).toBeInTheDocument();
        expect(badge.textContent).toMatch(/dialogic|Dialogisch|Dialogic/);
    });

    it("navigates to /session on click", () => {
        render(
            <MemoryRouter>
                <QuickStartButton suggestedMethod="deductive" />
            </MemoryRouter>,
        );
        fireEvent.click(screen.getByTestId("quick-start"));
        expect(mockNavigate).toHaveBeenCalledWith("/session");
    });

    it("does NOT navigate when disabled", () => {
        render(
            <MemoryRouter>
                <QuickStartButton suggestedMethod="deductive" disabled />
            </MemoryRouter>,
        );
        const btn = screen.getByTestId("quick-start") as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
        fireEvent.click(btn);
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
