import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Session from "./Session";
import type {LearningSession} from "../types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

const apiStart = vi.fn();
const apiMessage = vi.fn();
const apiRate = vi.fn();
const apiEnd = vi.fn();
vi.mock("../api/client", async () => {
    const actual = await vi.importActual<typeof import("../api/client")>(
        "../api/client",
    );
    return {
        ...actual,
        api: {
            ...actual.api,
            session: {
                start: (...args: unknown[]) => apiStart(...args),
                message: (...args: unknown[]) => apiMessage(...args),
                rate: (...args: unknown[]) => apiRate(...args),
                end: (...args: unknown[]) => apiEnd(...args),
            },
        },
    };
});

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("../utils/notify", () => ({
    notify: {
        error: (m: string) => toastError(m),
        success: (m: string) => toastSuccess(m),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

const SESSION: LearningSession = {
    id: "s-1",
    project_id: "p-1",
    method: "deductive",
    started_at: "2026-05-18T00:00:00Z",
    ended_at: null,
    cycle_step: 1,
    status: "active",
};

function renderSession() {
    return render(
        <MemoryRouter>
            <Session />
        </MemoryRouter>,
    );
}

describe("Session page", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        apiStart.mockReset();
        apiMessage.mockReset();
        apiRate.mockReset();
        apiEnd.mockReset();
        toastError.mockReset();
        toastSuccess.mockReset();
        localStorage.clear();
        localStorage.setItem("adaptive-learner.project_id", "p-1");
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("redirects to /onboarding when project_id is missing", async () => {
        localStorage.removeItem("adaptive-learner.project_id");
        renderSession();
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {replace: true});
        });
    });

    it("starts a new session and seeds the chat with the system prompt", async () => {
        apiStart.mockResolvedValue({
            session: SESSION,
            system_prompt: "Du bist ein Lerncoach.",
        });
        renderSession();
        await screen.findByTestId("session");
        expect(apiStart).toHaveBeenCalledWith({project_id: "p-1", lang: "de"});
        expect(screen.getByTestId("chat-message-system").textContent).toContain(
            "Du bist ein Lerncoach.",
        );
        expect(screen.getByTestId("method-badge-deductive")).toBeInTheDocument();
        expect(screen.getByTestId("cycle-progress")).toBeInTheDocument();
    });

    it("optimistically appends a user message and rollbacks on failure", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        const {ApiError} = await import("../api/client");
        apiMessage.mockRejectedValue(new ApiError(500, "DB down"));

        renderSession();
        await screen.findByTestId("session");
        fireEvent.change(screen.getByTestId("chat-input"), {
            target: {value: "Frage"},
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId("chat-send"));
        });

        await waitFor(() => {
            expect(toastError).toHaveBeenCalledWith("DB down");
        });
        // The optimistic message is rolled back.
        expect(screen.queryByText("Frage")).not.toBeInTheDocument();
    });

    it("persists a user message and renders the AI reply on success", async () => {
        // v0.2.0: /message returns a composite with user + assistant
        // messages + an optional ai_error. The page replaces the
        // optimistic user-message placeholder with the canonical
        // backend id, drops the "thinking…" placeholder, and
        // appends the assistant reply.
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiMessage.mockResolvedValue({
            user_message: {
                id: "m-user",
                session_id: "s-1",
                role: "user",
                content: "Hallo",
                created_at: "2026-05-18T00:01:00Z",
            },
            assistant_message: {
                id: "m-ai",
                session_id: "s-1",
                role: "assistant",
                content: "Hallo zurueck!",
                created_at: "2026-05-18T00:01:05Z",
            },
            ai_error: null,
        });
        renderSession();
        await screen.findByTestId("session");
        fireEvent.change(screen.getByTestId("chat-input"), {
            target: {value: "Hallo"},
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId("chat-send"));
        });
        await waitFor(() => {
            expect(apiMessage).toHaveBeenCalledWith("s-1", {role: "user", content: "Hallo"});
        });
        expect(screen.getByText("Hallo")).toBeInTheDocument();
        expect(screen.getByText("Hallo zurueck!")).toBeInTheDocument();
        // No toast on success.
        expect(toastError).not.toHaveBeenCalled();
    });

    it("renders a thinking placeholder while AI is in flight", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        let resolveMessage: (value: unknown) => void = () => {};
        apiMessage.mockReturnValue(
            new Promise((resolve) => {
                resolveMessage = resolve;
            }),
        );
        renderSession();
        await screen.findByTestId("session");
        fireEvent.change(screen.getByTestId("chat-input"), {
            target: {value: "Frage"},
        });
        fireEvent.click(screen.getByTestId("chat-send"));
        // Thinking placeholder appears immediately. The string
        // resolves via i18n fallback (DE catalog -> "Denkt nach …";
        // EN -> "Thinking…"). Match either.
        await waitFor(() => {
            const surface = screen.getByTestId("session-chat").textContent ?? "";
            expect(surface).toMatch(/Thinking|Denkt nach/);
        });
        // Now resolve so React tear-down doesn't warn about
        // a pending state update on an unmounted component.
        await act(async () => {
            resolveMessage({
                user_message: {
                    id: "u",
                    session_id: "s-1",
                    role: "user",
                    content: "Frage",
                    created_at: "2026-05-18T00:01:00Z",
                },
                assistant_message: null,
                ai_error: null,
            });
        });
    });

    it("surfaces ai_error via toast when AI couldn't reply", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiMessage.mockResolvedValue({
            user_message: {
                id: "m-user",
                session_id: "s-1",
                role: "user",
                content: "Frage",
                created_at: "2026-05-18T00:01:00Z",
            },
            assistant_message: null,
            ai_error: "No API key stored for provider 'anthropic'.",
        });
        renderSession();
        await screen.findByTestId("session");
        fireEvent.change(screen.getByTestId("chat-input"), {
            target: {value: "Frage"},
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId("chat-send"));
        });
        await waitFor(() => {
            expect(toastError).toHaveBeenCalledWith(
                "No API key stored for provider 'anthropic'.",
            );
        });
        // The user message is still rendered (saved server-side).
        expect(screen.getByText("Frage")).toBeInTheDocument();
    });

    it("end session submits rating then ends + navigates", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiRate.mockResolvedValue({
            id: "r-1",
            session_id: "s-1",
            understanding: 4,
            stress: 2,
            method_fit: 5,
            notes: null,
            created_at: "2026-05-18T00:05:00Z",
        });
        apiEnd.mockResolvedValue({session: {...SESSION, status: "completed"}});

        renderSession();
        await screen.findByTestId("session");
        fireEvent.click(screen.getByTestId("session-end"));
        await screen.findByTestId("rating-dialog");

        fireEvent.change(screen.getByTestId("rating-understanding"), {
            target: {value: "4"},
        });
        fireEvent.change(screen.getByTestId("rating-stress"), {
            target: {value: "2"},
        });
        fireEvent.change(screen.getByTestId("rating-method-fit"), {
            target: {value: "5"},
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId("rating-submit"));
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
        });
        expect(apiRate).toHaveBeenCalledWith("s-1", {
            understanding: 4,
            stress: 2,
            method_fit: 5,
            notes: null,
        });
        expect(apiEnd).toHaveBeenCalledWith("s-1");
        expect(toastSuccess).toHaveBeenCalled();
    });

    it("renders an error state when /start fails", async () => {
        const {ApiError} = await import("../api/client");
        apiStart.mockRejectedValue(new ApiError(500, "DB down"));
        renderSession();
        await screen.findByTestId("session-error");
        expect(screen.getByTestId("session-error").textContent).toContain("DB down");
    });
});
