import {render, screen, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, afterEach, describe, expect, it, vi} from "vitest";

import Landing from "./Landing";

// Mock useNavigate so we can assert on routing without
// running a real history stack.
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

describe("Landing page", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        localStorage.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function renderLanding() {
        return render(
            <MemoryRouter>
                <Landing />
            </MemoryRouter>,
        );
    }

    it("renders the title, subtitle, language picker, and CTA", () => {
        renderLanding();
        expect(screen.getByTestId("landing")).toBeInTheDocument();
        // Title text uses the hardcoded fallback when no backend.
        expect(screen.getByText(/Adaptive Learner/)).toBeInTheDocument();
        expect(screen.getByTestId("landing-lang-de")).toBeInTheDocument();
        expect(screen.getByTestId("landing-lang-en")).toBeInTheDocument();
        expect(screen.getByTestId("landing-start")).toBeInTheDocument();
    });

    it("clicking the start button routes to /onboarding", () => {
        renderLanding();
        fireEvent.click(screen.getByTestId("landing-start"));
        expect(mockNavigate).toHaveBeenCalledWith("/onboarding");
    });

    it("clicking a language button persists the language to localStorage", () => {
        renderLanding();
        fireEvent.click(screen.getByTestId("landing-lang-en"));
        expect(localStorage.getItem("adaptive-learner.language")).toBe("en");
    });

    it("the active language is announced via aria-checked", () => {
        renderLanding();
        // The provider falls back to ``de`` when no backend setting
        // has been loaded — that's the default we render here.
        const de = screen.getByTestId("landing-lang-de");
        const en = screen.getByTestId("landing-lang-en");
        expect(de.getAttribute("aria-checked")).toBe("true");
        expect(en.getAttribute("aria-checked")).toBe("false");
    });
});
