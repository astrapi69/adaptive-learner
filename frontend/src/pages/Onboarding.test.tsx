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

    it("Submit needs only name + topic — the 2 required fields (#92)", () => {
        renderOnboarding();
        const submit = screen.getByTestId("onboarding-submit") as HTMLButtonElement;
        expect(submit.disabled).toBe(true);
        fireEvent.change(screen.getByTestId("onboarding-name"), {
            target: {value: "Asterios"},
        });
        // Name alone is not enough.
        expect(submit.disabled).toBe(true);
        fireEvent.change(screen.getByTestId("onboarding-topic"), {
            target: {value: "Spanisch B1"},
        });
        // Name + topic alone enables submit — no other field required.
        expect(submit.disabled).toBe(false);
    });

    it("the optional fields live in a collapsed More-details disclosure (#92)", () => {
        renderOnboarding();
        const details = screen.getByTestId(
            "onboarding-more-details",
        ) as HTMLDetailsElement;
        expect(details).toBeInTheDocument();
        // Collapsed by default — beginner sees only name + topic.
        expect(details.open).toBe(false);
        // The optional fields are nested inside it.
        expect(details.contains(screen.getByTestId("onboarding-goal"))).toBe(true);
        expect(
            details.contains(screen.getByTestId("onboarding-timeframe")),
        ).toBe(true);
        expect(
            details.contains(screen.getByTestId("onboarding-daily-minutes")),
        ).toBe(true);
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

    it("has no Skip / Later affordance any more (#92)", () => {
        renderOnboarding();
        expect(screen.queryByTestId("onboarding-skip")).toBeNull();
        expect(screen.queryByTestId("onboarding-skip-top")).toBeNull();
    });

    // --- #92 regression: a new user starts with ONLY name + topic -------

    it("creates a project from name + topic alone, applying defaults", async () => {
        apiUserCreate.mockResolvedValue({
            id: "u-min",
            name: "Asterios",
            email: null,
            language: "de",
            created_at: "2026-06-06T00:00:00Z",
            updated_at: "2026-06-06T00:00:00Z",
        });
        apiProjectCreate.mockResolvedValue({
            id: "p-min",
            user_id: "u-min",
            topic: "Spanisch B1",
            goal: "Spanisch B1 lernen",
            timeframe: "Flexibel",
            daily_minutes: 15,
            current_problem: null,
            active: true,
            created_at: "2026-06-06T00:00:00Z",
            updated_at: "2026-06-06T00:00:00Z",
        });

        renderOnboarding();
        // Only the two required fields — the optional disclosure stays
        // collapsed and untouched.
        fireEvent.change(screen.getByTestId("onboarding-name"), {
            target: {value: "Asterios"},
        });
        fireEvent.change(screen.getByTestId("onboarding-topic"), {
            target: {value: "Spanisch B1"},
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("onboarding-submit"));
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/assessment");
        });

        expect(apiUserCreate).toHaveBeenCalledTimes(1);
        const projectCall = apiProjectCreate.mock.calls[0][1] as {
            topic: string;
            goal: string;
            timeframe: string;
            daily_minutes: number;
            current_problem: string | null;
            active: boolean;
        };
        expect(projectCall.topic).toBe("Spanisch B1");
        // Goal + timeframe default (non-empty — the backend requires it);
        // minutes default to 15; current_problem stays null.
        expect(projectCall.goal.length).toBeGreaterThan(0);
        expect(projectCall.goal).toContain("Spanisch B1");
        expect(projectCall.timeframe.length).toBeGreaterThan(0);
        expect(projectCall.daily_minutes).toBe(15);
        expect(projectCall.current_problem).toBeNull();
        expect(projectCall.active).toBe(true);
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-min");
        expect(localStorage.getItem("adaptive-learner.project_id")).toBe("p-min");
    });
});
