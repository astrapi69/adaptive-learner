import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Onboarding from "./Onboarding";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

// Mock the API client. The two POSTs are sequential — users
// create first, project create second — so the mocks return
// the canned User / LearningProject shapes.
const apiUserCreate = vi.fn();
const apiProjectCreate = vi.fn();
vi.mock("../api/client", async () => {
    const actual = await vi.importActual<typeof import("../api/client")>(
        "../api/client",
    );
    return {
        ...actual,
        api: {
            users: {
                create: (...args: unknown[]) => apiUserCreate(...args),
                projects: {
                    create: (...args: unknown[]) => apiProjectCreate(...args),
                    list: vi.fn(),
                },
                get: vi.fn(),
                update: vi.fn(),
            },
            // Spread the real shapes for the rest so anything else
            // the page might transitively import keeps compiling.
            projects: actual.api.projects,
            settings: actual.api.settings,
            assessment: actual.api.assessment,
            session: actual.api.session,
            tracking: actual.api.tracking,
            tools: actual.api.tools,
            plugins: actual.api.plugins,
            health: actual.api.health,
            i18n: actual.api.i18n,
        },
    };
});

// Mock the toast wrapper so the success/failure messages don't
// require a real ToastContainer.
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("../utils/notify", () => ({
    notify: {
        error: (msg: string) => toastError(msg),
        success: (msg: string) => toastSuccess(msg),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

function renderOnboarding() {
    return render(
        <MemoryRouter>
            <Onboarding />
        </MemoryRouter>,
    );
}

function fillForm() {
    fireEvent.change(screen.getByTestId("onboarding-name"), {
        target: {value: "Asterios"},
    });
    fireEvent.change(screen.getByTestId("onboarding-topic"), {
        target: {value: "Spanisch B1"},
    });
    fireEvent.change(screen.getByTestId("onboarding-goal"), {
        target: {value: "Konversation mit Kunden"},
    });
    fireEvent.change(screen.getByTestId("onboarding-timeframe"), {
        target: {value: "8 Wochen"},
    });
    fireEvent.change(screen.getByTestId("onboarding-daily-minutes"), {
        target: {value: "45"},
    });
}

describe("Onboarding page", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        apiUserCreate.mockReset();
        apiProjectCreate.mockReset();
        toastError.mockReset();
        toastSuccess.mockReset();
        localStorage.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders the form with the canonical field set", () => {
        renderOnboarding();
        expect(screen.getByTestId("onboarding")).toBeInTheDocument();
        expect(screen.getByTestId("onboarding-name")).toBeInTheDocument();
        expect(screen.getByTestId("onboarding-topic")).toBeInTheDocument();
        expect(screen.getByTestId("onboarding-goal")).toBeInTheDocument();
        expect(screen.getByTestId("onboarding-timeframe")).toBeInTheDocument();
        expect(screen.getByTestId("onboarding-daily-minutes")).toBeInTheDocument();
        expect(screen.getByTestId("onboarding-current-problem")).toBeInTheDocument();
    });

    it("Submit is disabled until all required fields are filled", () => {
        renderOnboarding();
        const submit = screen.getByTestId("onboarding-submit") as HTMLButtonElement;
        expect(submit.disabled).toBe(true);
        fillForm();
        expect(submit.disabled).toBe(false);
    });

    it("creates user then project, stores ids and navigates to /assessment", async () => {
        apiUserCreate.mockResolvedValue({
            id: "u-1",
            name: "Asterios",
            email: null,
            language: "de",
            created_at: "2026-05-18T00:00:00Z",
            updated_at: "2026-05-18T00:00:00Z",
        });
        apiProjectCreate.mockResolvedValue({
            id: "p-1",
            user_id: "u-1",
            topic: "Spanisch B1",
            goal: "Konversation mit Kunden",
            timeframe: "8 Wochen",
            daily_minutes: 45,
            current_problem: null,
            active: true,
            created_at: "2026-05-18T00:00:00Z",
            updated_at: "2026-05-18T00:00:00Z",
        });

        renderOnboarding();
        fillForm();

        await act(async () => {
            fireEvent.click(screen.getByTestId("onboarding-submit"));
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/assessment");
        });

        expect(apiUserCreate).toHaveBeenCalledWith({name: "Asterios", language: "de"});
        expect(apiProjectCreate).toHaveBeenCalledWith("u-1", {
            topic: "Spanisch B1",
            goal: "Konversation mit Kunden",
            timeframe: "8 Wochen",
            daily_minutes: 45,
            current_problem: null,
            active: true,
        });
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-1");
        expect(localStorage.getItem("adaptive-learner.project_id")).toBe("p-1");
        expect(toastSuccess).toHaveBeenCalled();
    });

    it("surfaces an ApiError detail to the user", async () => {
        const {ApiError} = await import("../api/client");
        apiUserCreate.mockRejectedValue(
            new ApiError(409, "User with email already exists.", "/users", "POST"),
        );

        renderOnboarding();
        fillForm();

        await act(async () => {
            fireEvent.click(screen.getByTestId("onboarding-submit"));
        });

        await waitFor(() => {
            expect(toastError).toHaveBeenCalledWith(
                "User with email already exists.",
            );
        });
        expect(mockNavigate).not.toHaveBeenCalledWith("/assessment");
    });

    it("the Back button navigates to /", () => {
        renderOnboarding();
        fireEvent.click(screen.getByTestId("onboarding-back"));
        expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    // --- v0.4.0: Skip / Later flow --------------------------------------

    it("renders a Skip / Later button visible alongside Submit + Back", () => {
        renderOnboarding();
        expect(screen.getByTestId("onboarding-skip")).toBeInTheDocument();
        expect(screen.getByTestId("onboarding-back")).toBeInTheDocument();
        expect(screen.getByTestId("onboarding-submit")).toBeInTheDocument();
    });

    it("Skip is enabled regardless of form completeness", () => {
        renderOnboarding();
        // No fields filled — Submit is disabled, but Skip is not.
        const submit = screen.getByTestId("onboarding-submit") as HTMLButtonElement;
        const skip = screen.getByTestId("onboarding-skip") as HTMLButtonElement;
        expect(submit.disabled).toBe(true);
        expect(skip.disabled).toBe(false);
    });

    it("Skip creates user + placeholder project + navigates to /dashboard", async () => {
        apiUserCreate.mockResolvedValue({
            id: "u-skip",
            name: "Learner",
            email: null,
            language: "en",
            created_at: "2026-05-18T00:00:00Z",
            updated_at: "2026-05-18T00:00:00Z",
        });
        apiProjectCreate.mockResolvedValue({
            id: "p-skip",
            user_id: "u-skip",
            topic: "My learning",
            goal: "Discover my learning style.",
            timeframe: "Flexible",
            daily_minutes: 30,
            current_problem: null,
            active: true,
            created_at: "2026-05-18T00:00:00Z",
            updated_at: "2026-05-18T00:00:00Z",
        });

        renderOnboarding();
        await act(async () => {
            fireEvent.click(screen.getByTestId("onboarding-skip"));
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
        });

        // The user call carries SOME name + language; the project
        // carries the four placeholder fields with 30 min/day.
        expect(apiUserCreate).toHaveBeenCalledTimes(1);
        const userCall = apiUserCreate.mock.calls[0][0] as {
            name: string;
            language: string;
        };
        expect(userCall.name.length).toBeGreaterThan(0);
        expect(userCall.language.length).toBeGreaterThan(0);

        expect(apiProjectCreate).toHaveBeenCalledTimes(1);
        const projectCall = apiProjectCreate.mock.calls[0][1] as {
            topic: string;
            goal: string;
            timeframe: string;
            daily_minutes: number;
            current_problem: string | null;
            active: boolean;
        };
        expect(projectCall.topic.length).toBeGreaterThan(0);
        expect(projectCall.goal.length).toBeGreaterThan(0);
        expect(projectCall.timeframe.length).toBeGreaterThan(0);
        expect(projectCall.daily_minutes).toBe(30);
        expect(projectCall.current_problem).toBeNull();
        expect(projectCall.active).toBe(true);

        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-skip");
        expect(localStorage.getItem("adaptive-learner.project_id")).toBe(
            "p-skip",
        );
        expect(toastSuccess).toHaveBeenCalled();
    });

    it("Skip surfaces ApiError details + does not navigate on failure", async () => {
        const {ApiError} = await import("../api/client");
        apiUserCreate.mockRejectedValue(new ApiError(500, "DB down"));
        renderOnboarding();
        await act(async () => {
            fireEvent.click(screen.getByTestId("onboarding-skip"));
        });
        await waitFor(() => {
            expect(toastError).toHaveBeenCalledWith("DB down");
        });
        expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
    });
});
