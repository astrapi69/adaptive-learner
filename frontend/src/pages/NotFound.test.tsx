import {render, screen, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import NotFound from "./NotFound";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

describe("NotFound", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders the 404 fallback", () => {
        render(
            <MemoryRouter>
                <NotFound />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("not-found")).toBeInTheDocument();
        expect(screen.getByText("404")).toBeInTheDocument();
    });

    it("clicking Home navigates to /", () => {
        render(
            <MemoryRouter>
                <NotFound />
            </MemoryRouter>,
        );
        fireEvent.click(screen.getByTestId("not-found-home"));
        expect(mockNavigate).toHaveBeenCalledWith("/");
    });
});
