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
const apiProjectUpdate = vi.fn();
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
            // The wizard patches the project through the projects
            // namespace (not users.projects).
            projects: {
                ...actual.api.projects,
                update: (...args: unknown[]) => apiProjectUpdate(...args),
            },
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
    // The quick-start form only has the two required fields (#92).
    fireEvent.change(screen.getByTestId("onboarding-name"), {
        target: {value: "Asterios"},
    });
    fireEvent.change(screen.getByTestId("onboarding-topic"), {
        target: {value: "Spanisch B1"},
    });
}

describe("Onboarding page", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        apiUserCreate.mockReset();
        apiProjectCreate.mockReset();
        apiProjectUpdate.mockReset();
        toastError.mockReset();
        toastSuccess.mockReset();
        localStorage.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders only the two required fields up front (#92)", () => {
        renderOnboarding();
        expect(screen.getByTestId("onboarding")).toBeInTheDocument();
        expect(screen.getByTestId("onboarding-name")).toBeInTheDocument();
        expect(screen.getByTestId("onboarding-topic")).toBeInTheDocument();
        // The profile fields now live in the post-creation wizard, not
        // the quick-start form.
        expect(screen.queryByTestId("onboarding-goal")).toBeNull();
        expect(screen.queryByTestId("onboarding-timeframe")).toBeNull();
        expect(screen.queryByTestId("onboarding-daily-minutes")).toBeNull();
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

    it("creates user + project with defaults, then shows the invite (#94)", async () => {
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
            goal: "Spanisch B1 lernen",
            timeframe: "Flexibel",
            daily_minutes: 15,
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

        // Lands on the optional-profile invitation, not /assessment.
        await screen.findByTestId("onboarding-invite");
        expect(mockNavigate).not.toHaveBeenCalled();

        expect(apiUserCreate).toHaveBeenCalledWith({name: "Asterios", language: "de"});
        const projectCall = apiProjectCreate.mock.calls[0][1] as {
            topic: string;
            goal: string;
            timeframe: string;
            daily_minutes: number;
            current_problem: string | null;
        };
        expect(projectCall.topic).toBe("Spanisch B1");
        expect(projectCall.goal.length).toBeGreaterThan(0);
        expect(projectCall.timeframe.length).toBeGreaterThan(0);
        expect(projectCall.daily_minutes).toBe(15);
        expect(projectCall.current_problem).toBeNull();
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-1");
        expect(localStorage.getItem("adaptive-learner.project_id")).toBe("p-1");
    });

    it("invite: Jump right in goes to /dashboard without the wizard", async () => {
        apiUserCreate.mockResolvedValue({id: "u-2", name: "A", language: "de"});
        apiProjectCreate.mockResolvedValue({
            id: "p-2",
            topic: "T",
            goal: "g",
            timeframe: "Flexibel",
            daily_minutes: 15,
            current_problem: null,
        });
        renderOnboarding();
        fillForm();
        await act(async () => {
            fireEvent.click(screen.getByTestId("onboarding-submit"));
        });
        await screen.findByTestId("onboarding-invite");
        fireEvent.click(screen.getByTestId("onboarding-invite-start-now"));
        // ``replace`` so browser-back can't return to the now-stale
        // onboarding form (#171).
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard", {
            replace: true,
        });
        expect(apiProjectUpdate).not.toHaveBeenCalled();
    });

    it("invite: Set up profile opens the wizard; finishing patches + routes", async () => {
        apiUserCreate.mockResolvedValue({id: "u-3", name: "A", language: "de"});
        apiProjectCreate.mockResolvedValue({
            id: "p-3",
            topic: "T",
            goal: "g",
            timeframe: "Flexibel",
            daily_minutes: 15,
            current_problem: null,
        });
        apiProjectUpdate.mockResolvedValue({id: "p-3"});

        renderOnboarding();
        fillForm();
        await act(async () => {
            fireEvent.click(screen.getByTestId("onboarding-submit"));
        });
        await screen.findByTestId("onboarding-invite");
        fireEvent.click(screen.getByTestId("onboarding-invite-setup-profile"));

        // Wizard appears; walk to the final step via "Next" x4.
        await screen.findByTestId("onboarding-wizard");
        for (let i = 0; i < 4; i++) {
            fireEvent.click(screen.getByTestId("onboarding-wizard-next"));
        }
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("onboarding-wizard-start-assessment"),
            );
        });

        await waitFor(() => {
            // ``replace`` so browser-back can't return to the now-stale
            // onboarding form, plus a ``backTo`` for the assessment's
            // first-step "Continue later" exit (#171).
            expect(mockNavigate).toHaveBeenCalledWith("/assessment", {
                replace: true,
                state: {backTo: "/dashboard"},
            });
        });
        expect(apiProjectUpdate).toHaveBeenCalledTimes(1);
        const [projectId, body] = apiProjectUpdate.mock.calls[0] as [
            string,
            {timeframe: string; daily_minutes: number},
        ];
        expect(projectId).toBe("p-3");
        expect(body.daily_minutes).toBe(15);
        expect(body.timeframe.length).toBeGreaterThan(0);
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

    // --- #92 regression: the default goal is derived from the topic ----

    it("derives the default goal from the topic (name + topic only)", async () => {
        apiUserCreate.mockResolvedValue({id: "u-min", name: "Asterios", language: "de"});
        apiProjectCreate.mockResolvedValue({
            id: "p-min",
            topic: "Spanisch B1",
            goal: "Spanisch B1 lernen",
            timeframe: "Flexibel",
            daily_minutes: 15,
            current_problem: null,
        });

        renderOnboarding();
        fireEvent.change(screen.getByTestId("onboarding-name"), {
            target: {value: "Asterios"},
        });
        fireEvent.change(screen.getByTestId("onboarding-topic"), {
            target: {value: "Spanisch B1"},
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("onboarding-submit"));
        });

        await screen.findByTestId("onboarding-invite");
        const projectCall = apiProjectCreate.mock.calls[0][1] as {goal: string};
        // The default goal interpolates the topic (e.g. "Learn Spanisch
        // B1" / "Spanisch B1 lernen") — non-empty and topic-derived.
        expect(projectCall.goal).toContain("Spanisch B1");
    });
});
