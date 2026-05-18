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
const apiSwitchRec = vi.fn();
const apiAcceptSwitch = vi.fn();
const apiSettingsGet = vi.fn();
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
                switchRecommendation: (...args: unknown[]) => apiSwitchRec(...args),
                acceptSwitch: (...args: unknown[]) => apiAcceptSwitch(...args),
            },
            settings: {
                ...actual.api.settings,
                get: (...args: unknown[]) => apiSettingsGet(...args),
            },
        },
    };
});

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
vi.mock("../utils/notify", () => ({
    notify: {
        error: (m: string) => toastError(m),
        success: (m: string) => toastSuccess(m),
        warning: vi.fn(),
        info: (m: string) => toastInfo(m),
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
        apiSwitchRec.mockReset();
        apiAcceptSwitch.mockReset();
        apiSettingsGet.mockReset();
        // Default: no recommendation. Per-test override when the
        // banner path is being exercised.
        apiSwitchRec.mockResolvedValue({recommended: false});
        // Default: pretend the user has no settings record yet
        // (rejects); the provider chip stays hidden. Per-test
        // override when the chip is the subject under test.
        apiSettingsGet.mockRejectedValue(new Error("no settings yet"));
        toastError.mockReset();
        toastSuccess.mockReset();
        toastInfo.mockReset();
        localStorage.clear();
        localStorage.setItem("adaptive-learner.project_id", "p-1");
        // Also seed user_id so the post-start settings fetch in
        // Session.tsx has somewhere to look up the active provider.
        localStorage.setItem("adaptive-learner.user_id", "u-1");
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
                content: "Hallo zurück!",
                created_at: "2026-05-18T00:01:05Z",
            },
            ai_error: null,
            // v0.4.0: cycle_step advanced from 1 to 2 on this
            // round-trip; the response carries the new session.
            session: {...SESSION, cycle_step: 2},
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
        expect(screen.getByText("Hallo zurück!")).toBeInTheDocument();
        // No toast on success.
        expect(toastError).not.toHaveBeenCalled();
        // v0.4.0: CycleProgress reflects the new step from the
        // response. data-state="current" moves from step 1 to
        // step 2.
        expect(
            screen.getByTestId("cycle-step-attempt").getAttribute("data-state"),
        ).toBe("current");
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
                session: SESSION,  // no advance: assistant_message null
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
            // ai_error path -> cycle_step unchanged.
            session: SESSION,
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

    // --- v0.2.0: MethodSwitchBanner integration ----------------------

    it("does NOT render the method-switch banner when no recommendation", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiSwitchRec.mockResolvedValue({recommended: false});
        renderSession();
        await screen.findByTestId("session");
        // Give the post-start fetchSwitchRecommendation a tick.
        await waitFor(() => expect(apiSwitchRec).toHaveBeenCalled());
        expect(screen.queryByTestId("method-switch-banner")).not.toBeInTheDocument();
    });

    it("renders the method-switch banner when a recommendation is returned", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiSwitchRec.mockResolvedValue({
            recommended: true,
            to_method: "dialogic",
            reason: "Stress trend rising.",
        });
        renderSession();
        await screen.findByTestId("session");
        await screen.findByTestId("method-switch-banner");
        expect(screen.getByTestId("method-switch-suggested").textContent).toMatch(
            /dialogic|Dialogisch|Dialogic/,
        );
        expect(screen.getByText("Stress trend rising.")).toBeInTheDocument();
    });

    it("Accept calls /switch and removes the banner", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiSwitchRec.mockResolvedValue({
            recommended: true,
            to_method: "dialogic",
            reason: "Stress trend.",
        });
        apiAcceptSwitch.mockResolvedValue({
            ...SESSION,
            method: "dialogic",
        });
        renderSession();
        await screen.findByTestId("method-switch-banner");
        await act(async () => {
            fireEvent.click(screen.getByTestId("method-switch-accept"));
        });
        await waitFor(() => {
            expect(apiAcceptSwitch).toHaveBeenCalledWith("s-1", {
                to_method: "dialogic",
                reason: "Stress trend.",
            });
        });
        expect(
            screen.queryByTestId("method-switch-banner"),
        ).not.toBeInTheDocument();
        expect(toastSuccess).toHaveBeenCalled();
    });

    it("Dismiss hides the banner without calling /switch", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiSwitchRec.mockResolvedValue({
            recommended: true,
            to_method: "dialogic",
            reason: "Stress trend.",
        });
        renderSession();
        await screen.findByTestId("method-switch-banner");
        fireEvent.click(screen.getByTestId("method-switch-dismiss"));
        expect(
            screen.queryByTestId("method-switch-banner"),
        ).not.toBeInTheDocument();
        expect(apiAcceptSwitch).not.toHaveBeenCalled();
    });

    // --- v0.2.0: active-provider chip in the session header --------

    it("renders the active-provider chip from user settings", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiSettingsGet.mockResolvedValue({
            id: "us-1",
            user_id: "u-1",
            language: "de",
            active_provider: "openai",
            has_anthropic_key: false,
            has_openai_key: true,
            has_gemini_key: false,
            model_override_anthropic: null,
            model_override_openai: null,
            model_override_gemini: null,
            created_at: "2026-05-18T00:00:00Z",
            updated_at: "2026-05-18T00:00:00Z",
        });
        renderSession();
        await screen.findByTestId("session");
        const chip = await screen.findByTestId("session-active-provider");
        // Either the localised label or the raw key is acceptable
        // depending on which i18n fallback resolved.
        expect(chip.textContent).toMatch(/openai|OpenAI|GPT/);
    });

    it("does NOT render the provider chip when settings fetch fails", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        // The beforeEach already rejects apiSettingsGet; just
        // assert the chip is absent.
        renderSession();
        await screen.findByTestId("session");
        // Allow the rejected promise + state update to settle.
        await waitFor(() => expect(apiSettingsGet).toHaveBeenCalled());
        expect(
            screen.queryByTestId("session-active-provider"),
        ).not.toBeInTheDocument();
    });

    // --- v0.5.0: Phase 8 step-evaluation wiring -------------------------

    it("fires info toast when step_evaluation is applied AND step actually moved", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiMessage.mockResolvedValue({
            user_message: {
                id: "u",
                session_id: "s-1",
                role: "user",
                content: "x",
                created_at: "2026-05-18T00:01:00Z",
            },
            assistant_message: {
                id: "a",
                session_id: "s-1",
                role: "assistant",
                content: "y",
                created_at: "2026-05-18T00:01:05Z",
            },
            ai_error: null,
            session: {...SESSION, cycle_step: 2},
            step_evaluation: {
                advance: true,
                confidence: 0.9,
                reason: "Strong understanding.",
                suggested_step: 2,
                fallback_used: false,
                applied: true,
                from_step: 1,
            },
        });
        renderSession();
        await screen.findByTestId("session");
        fireEvent.change(screen.getByTestId("chat-input"), {target: {value: "x"}});
        await act(async () => {
            fireEvent.click(screen.getByTestId("chat-send"));
        });
        await waitFor(() => {
            expect(toastInfo).toHaveBeenCalledTimes(1);
        });
        // Toast text mentions the new step's localised label
        // (input/attempt/error/feedback/adapt/repeat/integrate) — any
        // i18n fallback variant is acceptable.
        const toastArg = toastInfo.mock.calls[0][0] as string;
        expect(toastArg).toMatch(/attempt|Versuch|Intento|Tentative|Προσπάθεια/i);
    });

    it("does NOT fire info toast when step_evaluation is applied=false", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiMessage.mockResolvedValue({
            user_message: {
                id: "u",
                session_id: "s-1",
                role: "user",
                content: "x",
                created_at: "2026-05-18T00:01:00Z",
            },
            assistant_message: {
                id: "a",
                session_id: "s-1",
                role: "assistant",
                content: "y",
                created_at: "2026-05-18T00:01:05Z",
            },
            ai_error: null,
            session: SESSION,
            step_evaluation: {
                advance: true,
                confidence: 0.3,
                reason: "Mixed signal — stay.",
                suggested_step: 2,
                fallback_used: false,
                applied: false,
                from_step: 1,
            },
        });
        renderSession();
        await screen.findByTestId("session");
        fireEvent.change(screen.getByTestId("chat-input"), {target: {value: "x"}});
        await act(async () => {
            fireEvent.click(screen.getByTestId("chat-send"));
        });
        // Wait for the apiMessage call so the result-handling logic
        // has run; then assert the toast was NOT called.
        await waitFor(() => expect(apiMessage).toHaveBeenCalled());
        expect(toastInfo).not.toHaveBeenCalled();
    });

    it("does NOT fire toast when step is repeated (from_step == new cycle_step)", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiMessage.mockResolvedValue({
            user_message: {
                id: "u",
                session_id: "s-1",
                role: "user",
                content: "x",
                created_at: "2026-05-18T00:01:00Z",
            },
            assistant_message: {
                id: "a",
                session_id: "s-1",
                role: "assistant",
                content: "y",
                created_at: "2026-05-18T00:01:05Z",
            },
            ai_error: null,
            session: SESSION,  // cycle_step stays at 1
            step_evaluation: {
                advance: false,
                confidence: 0.8,
                reason: "Stay — not ready yet.",
                suggested_step: 1,
                fallback_used: false,
                applied: false,
                from_step: 1,
            },
        });
        renderSession();
        await screen.findByTestId("session");
        fireEvent.change(screen.getByTestId("chat-input"), {target: {value: "x"}});
        await act(async () => {
            fireEvent.click(screen.getByTestId("chat-send"));
        });
        await waitFor(() => expect(apiMessage).toHaveBeenCalled());
        expect(toastInfo).not.toHaveBeenCalled();
    });

    it("renders the evaluation reason as CycleProgress tooltip after a successful exchange", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiMessage.mockResolvedValue({
            user_message: {
                id: "u",
                session_id: "s-1",
                role: "user",
                content: "x",
                created_at: "2026-05-18T00:01:00Z",
            },
            assistant_message: {
                id: "a",
                session_id: "s-1",
                role: "assistant",
                content: "y",
                created_at: "2026-05-18T00:01:05Z",
            },
            ai_error: null,
            session: {...SESSION, cycle_step: 2},
            step_evaluation: {
                advance: true,
                confidence: 0.9,
                reason: "Learner produced a concrete example.",
                suggested_step: 2,
                fallback_used: false,
                applied: true,
                from_step: 1,
            },
        });
        renderSession();
        await screen.findByTestId("session");
        // No reason before the first exchange.
        expect(
            screen.queryByTestId("cycle-evaluation-reason"),
        ).not.toBeInTheDocument();
        fireEvent.change(screen.getByTestId("chat-input"), {target: {value: "x"}});
        await act(async () => {
            fireEvent.click(screen.getByTestId("chat-send"));
        });
        await waitFor(() => {
            expect(screen.getByTestId("cycle-evaluation-reason")).toBeInTheDocument();
        });
        expect(
            screen.getByTestId("cycle-evaluation-reason").textContent,
        ).toContain("Learner produced a concrete example.");
    });

    it("does NOT render tooltip when fallback_used is true (reason is a placeholder)", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiMessage.mockResolvedValue({
            user_message: {
                id: "u",
                session_id: "s-1",
                role: "user",
                content: "x",
                created_at: "2026-05-18T00:01:00Z",
            },
            assistant_message: {
                id: "a",
                session_id: "s-1",
                role: "assistant",
                content: "y",
                created_at: "2026-05-18T00:01:05Z",
            },
            ai_error: null,
            session: {...SESSION, cycle_step: 2},
            step_evaluation: {
                advance: true,
                confidence: 0.5,
                reason: "Evaluator output unparseable; defaulting to +1 advance.",
                suggested_step: 2,
                fallback_used: true,
                applied: true,
                from_step: 1,
            },
        });
        renderSession();
        await screen.findByTestId("session");
        fireEvent.change(screen.getByTestId("chat-input"), {target: {value: "x"}});
        await act(async () => {
            fireEvent.click(screen.getByTestId("chat-send"));
        });
        await waitFor(() => expect(apiMessage).toHaveBeenCalled());
        // Fallback reasons are diagnostic, not pedagogical — they
        // are NOT surfaced to the user as a "why this step" hint.
        expect(
            screen.queryByTestId("cycle-evaluation-reason"),
        ).not.toBeInTheDocument();
    });
});
