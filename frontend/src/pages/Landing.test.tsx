import {render, screen, fireEvent, waitFor} from "@testing-library/react";
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

// Mock the users.get call used by the returning-user detector.
const apiUsersGet = vi.fn();
vi.mock("../api/client", async () => {
    const actual = await vi.importActual<typeof import("../api/client")>(
        "../api/client",
    );
    return {
        ...actual,
        api: {
            ...actual.api,
            users: {
                ...actual.api.users,
                get: (...args: unknown[]) => apiUsersGet(...args),
            },
        },
    };
});

describe("Landing page", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        apiUsersGet.mockReset();
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

    // --- v0.4.0: returning-user detection -------------------------------

    it("does NOT call api.users.get when localStorage has no user_id", () => {
        renderLanding();
        expect(apiUsersGet).not.toHaveBeenCalled();
        // The regular Landing UI renders immediately.
        expect(screen.getByTestId("landing")).toBeInTheDocument();
        expect(screen.queryByTestId("landing-checking")).not.toBeInTheDocument();
    });

    it("verifies the stored user_id and redirects to /dashboard on success", async () => {
        localStorage.setItem("adaptive-learner.user_id", "u-back");
        apiUsersGet.mockResolvedValue({
            id: "u-back",
            name: "Returning Learner",
            email: null,
            language: "de",
            created_at: "2026-05-18T00:00:00Z",
            updated_at: "2026-05-18T00:00:00Z",
        });
        renderLanding();
        // While the GET is in flight the spinner-tile renders.
        expect(screen.getByTestId("landing-checking")).toBeInTheDocument();
        expect(screen.queryByTestId("landing")).not.toBeInTheDocument();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/dashboard", {
                replace: true,
            });
        });
        expect(apiUsersGet).toHaveBeenCalledWith("u-back");
        // The user_id stays in localStorage.
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-back");
    });

    it("clears localStorage + shows Landing UI on 404 from users.get", async () => {
        localStorage.setItem("adaptive-learner.user_id", "u-stale");
        localStorage.setItem("adaptive-learner.project_id", "p-stale");
        const {ApiError} = await import("../api/client");
        apiUsersGet.mockRejectedValue(new ApiError(404, "User not found."));

        renderLanding();
        await waitFor(() => {
            expect(screen.getByTestId("landing")).toBeInTheDocument();
        });
        expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard", {
            replace: true,
        });
        expect(localStorage.getItem("adaptive-learner.user_id")).toBeNull();
        expect(localStorage.getItem("adaptive-learner.project_id")).toBeNull();
    });

    it("keeps localStorage on 5xx + shows Landing so the user can retry", async () => {
        localStorage.setItem("adaptive-learner.user_id", "u-1");
        const {ApiError} = await import("../api/client");
        apiUsersGet.mockRejectedValue(new ApiError(500, "DB down"));

        renderLanding();
        await waitFor(() => {
            expect(screen.getByTestId("landing")).toBeInTheDocument();
        });
        // The id is preserved so a reload retries — not cleared.
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-1");
        expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard", {
            replace: true,
        });
    });
});
