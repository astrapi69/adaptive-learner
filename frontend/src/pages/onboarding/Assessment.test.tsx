import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Assessment from "./Assessment";
import type {AssessmentQuestion, LearningProfile} from "../../types";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
    const actual = await vi.importActual<typeof import("react-router")>(
        "react-router",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

const apiQuestions = vi.fn();
const apiEvaluate = vi.fn();
vi.mock("../../api/client", async () => {
    const actual = await vi.importActual<typeof import("../../api/client")>(
        "../../api/client",
    );
    return {
        ...actual,
        api: {
            ...actual.api,
            assessment: {
                questions: (...args: unknown[]) => apiQuestions(...args),
                evaluate: (...args: unknown[]) => apiEvaluate(...args),
                profile: vi.fn(),
            },
        },
    };
});

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("../../utils/notify", () => ({
    notify: {
        error: (m: string) => toastError(m),
        success: (m: string) => toastSuccess(m),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

// Replace ProfileRadar with a lightweight stand-in: recharts'
// ResponsiveContainer goes wide on dimensions that happy-dom
// fudges, and the chart's rendering is orthogonal to the page
// behaviour we want to pin here.
vi.mock("../../components/progress/ProfileRadar", () => ({
    default: ({profile}: {profile: LearningProfile}) => (
        <div data-testid="profile-radar">
            {`${profile.dominant_method}@${profile.version}`}
        </div>
    ),
}));

const Q: AssessmentQuestion[] = [
    {
        id: "q01",
        type: "multi",
        text: "Wie gehst du an ein neues Thema heran?",
        answers: [
            {id: "a", text: "Regeln zuerst.", weights: {deductive: 1.0}},
            {id: "b", text: "Beispiele zuerst.", weights: {inductive: 1.0}},
        ],
    },
    {
        id: "q02",
        type: "single",
        text: "Magst du Praezision oder Intuition?",
        answers: [
            {id: "a", text: "Praezision.", weights: {deductive: 1.0}},
            {id: "b", text: "Intuition.", weights: {inductive: 1.0}},
        ],
    },
];

const PROFILE: LearningProfile = {
    id: "lp1",
    user_id: "u1",
    project_id: "p1",
    deductive: 0.8,
    inductive: 0.1,
    error_based: 0.05,
    dialogic: 0.0,
    contextual: 0.0,
    ai_adaptive: 0.05,
    assessed_at: "2026-05-18T00:00:00Z",
    version: 1,
    dominant_method: "deductive",
};

function renderAssessment() {
    return render(
        <MemoryRouter>
            <Assessment />
        </MemoryRouter>,
    );
}

/** Render with a router ``state.backTo`` on the /assessment entry. */
function renderAssessmentWithBackTo(backTo: string) {
    return render(
        <MemoryRouter
            initialEntries={[{pathname: "/assessment", state: {backTo}}]}
        >
            <Assessment />
        </MemoryRouter>,
    );
}

describe("Assessment page", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        apiQuestions.mockReset();
        apiEvaluate.mockReset();
        toastError.mockReset();
        toastSuccess.mockReset();
        localStorage.clear();
        // The page reads project_id from localStorage; pre-seed it.
        localStorage.setItem("adaptive-learner.project_id", "p1");
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("redirects to /onboarding when no project_id is set", async () => {
        localStorage.removeItem("adaptive-learner.project_id");
        renderAssessment();
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {replace: true});
        });
    });

    it("loads questions and walks through Next + Submit", async () => {
        apiQuestions.mockResolvedValue(Q);
        apiEvaluate.mockResolvedValue(PROFILE);
        renderAssessment();

        // Wait for the first question to render.
        await waitFor(() => {
            expect(screen.getByTestId("question-card-q01")).toBeInTheDocument();
        });

        // Pick answer 'a' for q01, advance.
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        fireEvent.click(screen.getByTestId("assessment-next"));
        expect(await screen.findByTestId("question-card-q02")).toBeInTheDocument();

        // Pick answer 'b' for q02, submit.
        fireEvent.click(screen.getByTestId("question-q02-answer-b"));
        await act(async () => {
            fireEvent.click(screen.getByTestId("assessment-submit"));
        });

        await waitFor(() => {
            expect(screen.getByTestId("assessment-result")).toBeInTheDocument();
        });
        expect(apiEvaluate).toHaveBeenCalledWith({
            project_id: "p1",
            answers: [
                {question_id: "q01", answer_ids: ["a"]},
                {question_id: "q02", answer_ids: ["b"]},
            ],
        });
        expect(toastSuccess).toHaveBeenCalled();
        expect(screen.getByTestId("profile-radar")).toBeInTheDocument();
        expect(screen.getByTestId("assessment-dominant-method").textContent).toMatch(
            /deductive|Deduktiv|Deductive/,
        );
    });

    it("Submit button is disabled while a question is unanswered", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        // Pick an answer for q01 so Next is enabled, advance.
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        fireEvent.click(screen.getByTestId("assessment-next"));
        await screen.findByTestId("question-card-q02");
        const submit = screen.getByTestId("assessment-submit") as HTMLButtonElement;
        expect(submit.disabled).toBe(true);
        fireEvent.click(screen.getByTestId("question-q02-answer-a"));
        expect(submit.disabled).toBe(false);
    });

    it("Continue button on the result screen routes to /dashboard", async () => {
        apiQuestions.mockResolvedValue(Q);
        apiEvaluate.mockResolvedValue(PROFILE);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        fireEvent.click(screen.getByTestId("assessment-next"));
        await screen.findByTestId("question-card-q02");
        fireEvent.click(screen.getByTestId("question-q02-answer-a"));
        await act(async () => {
            fireEvent.click(screen.getByTestId("assessment-submit"));
        });
        await screen.findByTestId("assessment-result");
        fireEvent.click(screen.getByTestId("assessment-continue"));
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });

    it("renders an error state when the questions fetch fails", async () => {
        const {ApiError} = await import("../../api/client");
        apiQuestions.mockRejectedValue(new ApiError(500, "DB down"));
        renderAssessment();
        await screen.findByTestId("assessment-error");
        expect(screen.getByTestId("assessment-error").textContent).toContain("DB down");
    });

    it("multi-select question lets the user pick 2 answers", async () => {
        apiQuestions.mockResolvedValue(Q);
        apiEvaluate.mockResolvedValue(PROFILE);
        renderAssessment();

        await screen.findByTestId("question-card-q01");
        // q01 is multi — both clicks stick.
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        fireEvent.click(screen.getByTestId("question-q01-answer-b"));
        expect(
            screen.getByTestId("question-q01-answer-a").getAttribute("aria-checked"),
        ).toBe("true");
        expect(
            screen.getByTestId("question-q01-answer-b").getAttribute("aria-checked"),
        ).toBe("true");

        fireEvent.click(screen.getByTestId("assessment-next"));
        await screen.findByTestId("question-card-q02");
        fireEvent.click(screen.getByTestId("question-q02-answer-a"));
        await act(async () => {
            fireEvent.click(screen.getByTestId("assessment-submit"));
        });

        await screen.findByTestId("assessment-result");
        expect(apiEvaluate).toHaveBeenCalledWith({
            project_id: "p1",
            answers: [
                {question_id: "q01", answer_ids: ["a", "b"]},
                {question_id: "q02", answer_ids: ["a"]},
            ],
        });
    });

    it("single-select question REPLACES the prior pick on second click", async () => {
        apiQuestions.mockResolvedValue(Q);
        apiEvaluate.mockResolvedValue(PROFILE);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        fireEvent.click(screen.getByTestId("assessment-next"));
        await screen.findByTestId("question-card-q02");
        // q02 is single — clicking 'b' after 'a' unselects 'a'.
        fireEvent.click(screen.getByTestId("question-q02-answer-a"));
        fireEvent.click(screen.getByTestId("question-q02-answer-b"));
        expect(
            screen.getByTestId("question-q02-answer-a").getAttribute("aria-checked"),
        ).toBe("false");
        expect(
            screen.getByTestId("question-q02-answer-b").getAttribute("aria-checked"),
        ).toBe("true");
    });

    it("multi-select clicking the same answer twice toggles it off", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        expect(
            screen.getByTestId("question-q01-answer-a").getAttribute("aria-checked"),
        ).toBe("true");
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        expect(
            screen.getByTestId("question-q01-answer-a").getAttribute("aria-checked"),
        ).toBe("false");
        // With no answer selected, the Next button is disabled.
        const next = screen.getByTestId("assessment-next") as HTMLButtonElement;
        expect(next.disabled).toBe(true);
    });
});

describe("Assessment swipe + keyboard navigation (Phase 23B)", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        apiQuestions.mockReset();
        apiEvaluate.mockReset();
        toastError.mockReset();
        toastSuccess.mockReset();
        localStorage.clear();
        localStorage.setItem("adaptive-learner.project_id", "p1");
        // Enable gestures explicitly (test env may be desktop-like).
        localStorage.setItem("adaptive-learner.gestures_enabled", "true");
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("ArrowRight advances to the next question after selecting an answer", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        // Answer q01 first; without an answer ArrowRight is a no-op.
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        await act(async () => {
            fireEvent.keyDown(window, {key: "ArrowRight"});
        });
        await screen.findByTestId("question-card-q02");
    });

    it("ArrowLeft retreats to the previous question", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        await act(async () => {
            fireEvent.keyDown(window, {key: "ArrowRight"});
        });
        await screen.findByTestId("question-card-q02");
        await act(async () => {
            fireEvent.keyDown(window, {key: "ArrowLeft"});
        });
        await screen.findByTestId("question-card-q01");
    });

    it("ArrowLeft on the first question is a no-op (no negative index)", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        await act(async () => {
            fireEvent.keyDown(window, {key: "ArrowLeft"});
        });
        // Still on the first question.
        expect(screen.getByTestId("question-card-q01")).toBeInTheDocument();
    });

    it("renders the swipe hint on the first question (once)", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        expect(
            screen.queryByTestId("assessment-swipe-hint"),
        ).toBeInTheDocument();
    });

    it("hint is hidden once the user clicks Next (markGestureHintShown persisted)", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        fireEvent.click(screen.getByTestId("assessment-next"));
        await screen.findByTestId("question-card-q02");
        // After Back to q01, the hint should NOT re-appear because
        // it was already dismissed.
        fireEvent.click(screen.getByTestId("assessment-prev"));
        await screen.findByTestId("question-card-q01");
        expect(screen.queryByTestId("assessment-swipe-hint")).toBeNull();
        expect(localStorage.getItem("adaptive-learner.gestures_hint_shown")).toBe(
            "true",
        );
    });

    it("ArrowRight on the last question (with all answers) triggers submit", async () => {
        apiQuestions.mockResolvedValue(Q);
        apiEvaluate.mockResolvedValue(PROFILE);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        fireEvent.click(screen.getByTestId("assessment-next"));
        await screen.findByTestId("question-card-q02");
        fireEvent.click(screen.getByTestId("question-q02-answer-a"));
        await act(async () => {
            fireEvent.keyDown(window, {key: "ArrowRight"});
        });
        await waitFor(() => {
            expect(apiEvaluate).toHaveBeenCalledTimes(1);
        });
    });

    it("ArrowRight is suppressed when an INPUT has focus", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        // Simulate an input field having focus — keyDown's target
        // is INPUT, so the hook should bail.
        const fakeInput = document.createElement("input");
        document.body.appendChild(fakeInput);
        await act(async () => {
            const ev = new KeyboardEvent("keydown", {
                key: "ArrowRight",
                bubbles: true,
            });
            Object.defineProperty(ev, "target", {value: fakeInput});
            window.dispatchEvent(ev);
        });
        // We're still on q01 since the input intercepted it.
        expect(screen.getByTestId("question-card-q01")).toBeInTheDocument();
    });

    // --- First-step exit / no dead-end (#171) -----------------------------

    it("offers a 'Continue later' exit on the first question, not a disabled Previous", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        // The disabled Previous-question button is replaced by a working
        // exit so the first step is never a dead-end.
        expect(screen.queryByTestId("assessment-prev")).toBeNull();
        const exit = screen.getByTestId("assessment-exit");
        expect((exit as HTMLButtonElement).disabled).toBe(false);
    });

    it("the first-step exit navigates to the Dashboard by default", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        fireEvent.click(screen.getByTestId("assessment-exit"));
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });

    it("the first-step exit honours location.state.backTo", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessmentWithBackTo("/settings");
        await screen.findByTestId("question-card-q01");
        fireEvent.click(screen.getByTestId("assessment-exit"));
        expect(mockNavigate).toHaveBeenCalledWith("/settings");
    });

    it("shows Previous (not the exit) once past the first question", async () => {
        apiQuestions.mockResolvedValue(Q);
        renderAssessment();
        await screen.findByTestId("question-card-q01");
        fireEvent.click(screen.getByTestId("question-q01-answer-a"));
        fireEvent.click(screen.getByTestId("assessment-next"));
        await screen.findByTestId("question-card-q02");
        expect(screen.queryByTestId("assessment-exit")).toBeNull();
        expect(screen.getByTestId("assessment-prev")).toBeInTheDocument();
    });
});
