import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Session from "./Session";
import type {LearningSession} from "../../types";
import {TestFeatureProvider} from "../../features/testFeatureProvider";
import type {FeatureContext} from "../../features/featureConfig";

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
const apiSettingsGetAvailableModels = vi.fn();
const apiSessionGet = vi.fn();
const apiSessionGetMessages = vi.fn();
const apiProjectsGet = vi.fn();
const apiImportsGet = vi.fn();

/**
 * v1.6.0 — Session.tsx now sends via ``streamMessage``. The
 * existing tests configure ``apiMessage`` with a result; this
 * shim translates that result into the equivalent stream
 * sequence (onStart -> onChunk(assistant_content) -> onDone)
 * so the existing assertions about navigation, state, toasts,
 * and step-evaluation handling stay untouched.
 */
const apiStreamMessage = vi.fn(
    async (
        sessionId: string,
        body: unknown,
        handlers: {
            onStart?: (userMessage: unknown) => void;
            onChunk: (delta: string) => void;
            onDone: (result: unknown) => void;
        },
    ) => {
        const result = (await apiMessage(sessionId, body)) as {
            user_message?: {content?: string};
            assistant_message?: {content?: string} | null;
        };
        handlers.onStart?.(result.user_message);
        const text = result.assistant_message?.content;
        if (typeof text === "string" && text) {
            handlers.onChunk(text);
        }
        handlers.onDone(result);
    },
);

vi.mock("../../api/client", async () => {
    const actual = await vi.importActual<typeof import("../../api/client")>(
        "../../api/client",
    );
    return {
        ...actual,
        api: {
            ...actual.api,
            session: {
                start: (...args: unknown[]) => apiStart(...args),
                message: (...args: unknown[]) => apiMessage(...args),
                streamMessage: (...args: unknown[]) =>
                    apiStreamMessage(
                        ...(args as Parameters<typeof apiStreamMessage>),
                    ),
                rate: (...args: unknown[]) => apiRate(...args),
                end: (...args: unknown[]) => apiEnd(...args),
                switchRecommendation: (...args: unknown[]) => apiSwitchRec(...args),
                acceptSwitch: (...args: unknown[]) => apiAcceptSwitch(...args),
                get: (...args: unknown[]) => apiSessionGet(...args),
                getMessages: (...args: unknown[]) =>
                    apiSessionGetMessages(...args),
            },
            settings: {
                ...actual.api.settings,
                get: (...args: unknown[]) => apiSettingsGet(...args),
                getAvailableModels: (...args: unknown[]) =>
                    apiSettingsGetAvailableModels(...args),
            },
            // Header-only, fire-and-forget reads. Mocked so the page never
            // makes a real connection in the unit run (the project topic + the
            // imported-conversation topic lookups).
            projects: {
                ...actual.api.projects,
                get: (...args: unknown[]) => apiProjectsGet(...args),
            },
            imports: {
                ...actual.api.imports,
                get: (...args: unknown[]) => apiImportsGet(...args),
            },
        },
    };
});

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
vi.mock("../../utils/notify", () => ({
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

function renderSession(context?: Partial<FeatureContext>) {
    // Wrap in the feature provider Session now consumes (#1158). Default
    // context = API mode with a key, so every existing test keeps the
    // session feature ``active`` and behaves exactly as before; no-key tests
    // pass ``{mode: "dexie", hasAiKey: false}`` to drive the gate.
    return render(
        <TestFeatureProvider context={context}>
            <MemoryRouter>
                <Session />
            </MemoryRouter>
        </TestFeatureProvider>,
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
        apiSettingsGetAvailableModels.mockReset();
        apiSessionGet.mockReset();
        apiSessionGetMessages.mockReset();
        apiProjectsGet.mockReset();
        apiImportsGet.mockReset();
        // Defaults: header-only reads resolve to empty stubs so no test makes a
        // real network connection (both are fire-and-forget in Session.tsx).
        apiProjectsGet.mockResolvedValue({id: "p-1", topic: "Quantenphysik"});
        apiImportsGet.mockResolvedValue({title: null, analysis_result: null});
        // Default: no recommendation. Per-test override when the
        // banner path is being exercised.
        apiSwitchRec.mockResolvedValue({recommended: false});
        // Default: pretend the user has no settings record yet
        // (rejects); the provider chip stays hidden. Per-test
        // override when the chip is the subject under test.
        apiSettingsGet.mockRejectedValue(new Error("no settings yet"));
        // Default: empty available-models. Tests that exercise the
        // model name lookup override per-test.
        apiSettingsGetAvailableModels.mockResolvedValue([]);
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

    // #1158 — second line of defense: a direct /session navigation without a
    // usable AI key (Dexie mode, no key) must NOT create/resume a dead
    // chat. It shows a clean no-key empty state with a link to the AI
    // settings tab instead.
    it("no AI key (Dexie): renders the no-key empty state, never starts a session", async () => {
        renderSession({mode: "dexie", hasAiKey: false});
        await screen.findByTestId("session-no-key");
        // The actionable link to the AI settings tab is present.
        const link = screen.getByTestId("api-key-required-link");
        expect(link.getAttribute("href")).toContain("/settings?tab=ai");
        // No session was created and the chat never rendered.
        expect(apiStart).not.toHaveBeenCalled();
        expect(screen.queryByTestId("session")).not.toBeInTheDocument();
    });

    it("AI key present: a normal session renders the chat (gate does not fire)", async () => {
        apiStart.mockResolvedValue({
            session: SESSION,
            system_prompt: "Du bist ein Lerncoach.",
        });
        renderSession({mode: "dexie", hasAiKey: true});
        await screen.findByTestId("session");
        expect(screen.queryByTestId("session-no-key")).not.toBeInTheDocument();
        expect(apiStart).toHaveBeenCalled();
    });

    it("starts a new session, seeds the system prompt internally, but HIDES it from the chat", async () => {
        // v1.23.1 — the system prompt is metadata for the AI
        // orchestrator. It MUST be seeded into the message
        // array (so the next /message round-trip includes it
        // in the chronological history) but MUST NOT render
        // as a chat bubble; the welcome empty-state surfaces
        // instead.
        apiStart.mockResolvedValue({
            session: SESSION,
            system_prompt: "Du bist ein Lerncoach.",
        });
        renderSession();
        await screen.findByTestId("session");
        expect(apiStart).toHaveBeenCalledWith({project_id: "p-1", lang: "de"});
        expect(
            screen.queryByTestId("chat-message-system"),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("chat-welcome")).toBeInTheDocument();
        expect(screen.getByTestId("method-badge-deductive")).toBeInTheDocument();
        expect(screen.getByTestId("cycle-progress")).toBeInTheDocument();
    });

    it("optimistically appends a user message and rollbacks on failure", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        const {ApiError} = await import("../../api/client");
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

    it("renders a streaming assistant bubble while the AI reply is in flight", async () => {
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
        // v1.6.0: instead of a "Thinking…" placeholder, the chat
        // surface shows the streaming bubble (testid suffix
        // ``-streaming``) which carries the live cursor character
        // until the stream settles.
        await waitFor(() => {
            expect(
                screen.getByTestId("chat-message-assistant-streaming"),
            ).toBeInTheDocument();
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

    it("maps the no_api_key code to a friendly toast (not the raw English detail)", async () => {
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
            // Dexie session-flow classifies the missing-key case so
            // the UI can show a friendly, localized message.
            ai_error_code: "no_api_key",
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
            expect(toastError).toHaveBeenCalled();
        });
        const shown = toastError.mock.calls[0][0] as string;
        // The friendly message guides to Settings + reassures that
        // lessons work without a key; it must NOT be the raw detail.
        expect(shown).not.toBe("No API key stored for provider 'anthropic'.");
        expect(shown).toMatch(/Settings|Einstellungen|key|Schlüssel/i);
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

        // v0.6.0 / 9C: ratings are now 1-5 button groups, not
        // sliders. Click the desired value's button on each row.
        fireEvent.click(screen.getByTestId("rating-understanding-4"));
        fireEvent.click(screen.getByTestId("rating-stress-2"));
        fireEvent.click(screen.getByTestId("rating-method-fit-5"));
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
        const {ApiError} = await import("../../api/client");
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

    it("renders the active model name next to the provider when discovery cache has it", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiSettingsGet.mockResolvedValue({
            id: "us-1",
            user_id: "u-1",
            language: "de",
            active_provider: "anthropic",
            has_anthropic_key: true,
            has_openai_key: false,
            has_gemini_key: false,
            model_override_anthropic: "claude-opus-4-20250514",
            model_override_openai: null,
            model_override_gemini: null,
            created_at: "2026-05-18T00:00:00Z",
            updated_at: "2026-05-18T00:00:00Z",
        });
        apiSettingsGetAvailableModels.mockResolvedValue([
            {
                id: "claude-opus-4-20250514",
                name: "Claude Opus 4",
                context_window: 200000,
                description: null,
            },
        ]);
        renderSession();
        await screen.findByTestId("session");
        const modelEl = await screen.findByTestId("session-active-model");
        expect(modelEl.textContent).toBe("Claude Opus 4");
    });

    it("renders the raw model id when discovery cache has no match", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        apiSettingsGet.mockResolvedValue({
            id: "us-1",
            user_id: "u-1",
            language: "de",
            active_provider: "anthropic",
            has_anthropic_key: true,
            has_openai_key: false,
            has_gemini_key: false,
            model_override_anthropic: "claude-mystery-foo",
            model_override_openai: null,
            model_override_gemini: null,
            created_at: "2026-05-18T00:00:00Z",
            updated_at: "2026-05-18T00:00:00Z",
        });
        apiSettingsGetAvailableModels.mockResolvedValue([
            {
                id: "claude-opus-4-20250514",
                name: "Claude Opus 4",
                context_window: 200000,
                description: null,
            },
        ]);
        renderSession();
        await screen.findByTestId("session");
        const modelEl = await screen.findByTestId("session-active-model");
        expect(modelEl.textContent).toBe("claude-mystery-foo");
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

    // --- Bug 6 (regression): HelpTooltip rendered on the Session h1 ----
    //
    // Same shape as the Dashboard pin in Dashboard.test.tsx —
    // pre-Phase-38 the contextual help icons + tooltips were
    // mounted only on Onboarding, leaving every other route
    // dark. Asserting the testid here prevents a future
    // refactor from silently dropping the tooltip from the
    // chat-page heading.

    it("renders a dotted-underline tooltip on the Learning session heading", async () => {
        apiStart.mockResolvedValue({session: SESSION, system_prompt: "S"});
        renderSession();
        await screen.findByTestId("session");
        expect(
            screen.getByTestId("help-term-learning_session"),
        ).toBeInTheDocument();
    });

    // --- Bug 7 (regression): resume an existing session via ?session= ---
    //
    // The end-to-end contract: when Session.tsx mounts with a
    // ``?session=<id>`` query param, it MUST NOT call ``start()``
    // (which would create a fresh session) and MUST instead
    // fetch the existing session + replay its message history.

    it("resume mode: ?session=<id> fetches the existing session, no new start", async () => {
        apiSessionGet.mockResolvedValue({
            id: "resumed-session-id",
            project_id: "p-1",
            method: "deductive",
            started_at: "2026-05-22T10:00:00Z",
            ended_at: null,
            cycle_step: 3,
            status: "active",
            cycle_count: 1,
            cycle_topics: [],
            // #1162 — this test documents the GENERIC resume contract
            // ("replay its message history"). An imported session now opens
            // CLEAN (#1143: only the system/intro message, prior exchange
            // hidden), so a non-null imported FK here contradicts the
            // assertions below. Use a non-imported session so the history
            // actually renders. The imported-clean path is covered separately.
            // #1163 also mocks the header-only projects.get / imports.get reads
            // so the suite makes no real network connection.
            imported_conversation_id: null,
        });
        apiSessionGetMessages.mockResolvedValue([
            {
                id: "sys-1",
                session_id: "resumed-session-id",
                role: "system",
                content: "Du bist ein deduktiver Lerncoach.",
                created_at: "2026-05-22T10:00:00Z",
            },
            {
                id: "u-1",
                session_id: "resumed-session-id",
                role: "user",
                content: "Erkläre mir Quantenfeldtheorie.",
                created_at: "2026-05-22T10:00:05Z",
            },
            {
                id: "a-1",
                session_id: "resumed-session-id",
                role: "assistant",
                content: "Quantenfeldtheorie verbindet…",
                created_at: "2026-05-22T10:00:10Z",
            },
        ]);
        render(
            <TestFeatureProvider>
                <MemoryRouter
                    initialEntries={["/session?session=resumed-session-id"]}
                >
                    <Session />
                </MemoryRouter>
            </TestFeatureProvider>,
        );
        await screen.findByTestId("session");
        // The two resume endpoints fired.
        expect(apiSessionGet).toHaveBeenCalledWith("resumed-session-id");
        expect(apiSessionGetMessages).toHaveBeenCalledWith(
            "resumed-session-id",
        );
        // Critical: ``start()`` was NOT called — no duplicate session.
        expect(apiStart).not.toHaveBeenCalled();
        // Chat replays user + assistant turns; the system
        // prompt is held in state for the next /message
        // round-trip but is HIDDEN from the rendered list
        // per the v1.23.1 system-prompt-hiding rule.
        expect(
            screen.queryByText("Du bist ein deduktiver Lerncoach."),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText("Erkläre mir Quantenfeldtheorie."),
        ).toBeInTheDocument();
        expect(screen.getByText("Quantenfeldtheorie verbindet…")).toBeInTheDocument();
        // The session header reflects the resumed cycle_step
        // (3 -> "error" per CYCLE_STEPS[2]).
        expect(
            screen.getByTestId("cycle-step-error").getAttribute("data-state"),
        ).toBe("current");
    });

    it("resume mode bypasses the projectId guard (does NOT redirect to onboarding)", async () => {
        // No project_id in localStorage — would normally redirect
        // to /onboarding. Resume mode must skip that guard since
        // the session already exists.
        localStorage.removeItem("adaptive-learner.project_id");
        apiSessionGet.mockResolvedValue({
            id: "resumed-session-id",
            project_id: "p-1",
            method: "deductive",
            started_at: "2026-05-22T10:00:00Z",
            ended_at: null,
            cycle_step: 1,
            status: "active",
            cycle_count: 1,
            cycle_topics: [],
            imported_conversation_id: null,
        });
        apiSessionGetMessages.mockResolvedValue([]);
        render(
            <TestFeatureProvider>
                <MemoryRouter
                    initialEntries={["/session?session=resumed-session-id"]}
                >
                    <Session />
                </MemoryRouter>
            </TestFeatureProvider>,
        );
        await screen.findByTestId("session");
        expect(mockNavigate).not.toHaveBeenCalledWith("/onboarding", {
            replace: true,
        });
        expect(apiStart).not.toHaveBeenCalled();
    });

    // --- v0.6.0 / 9D: offline guard on session start --------------------

    it("shows an offline-blocked message and does NOT fire api.session.start when offline", async () => {
        const original = Object.getOwnPropertyDescriptor(
            window.navigator,
            "onLine",
        );
        Object.defineProperty(window.navigator, "onLine", {
            configurable: true,
            value: false,
        });
        try {
            renderSession();
            // The start error path renders; the API never fires.
            await screen.findByTestId("session-error");
            expect(apiStart).not.toHaveBeenCalled();
            expect(
                screen.getByTestId("session-error").textContent,
            ).toMatch(
                /offline|Hors ligne|Sin conexion|Εκτός σύνδεσης|Du bist offline/i,
            );
        } finally {
            if (original) {
                Object.defineProperty(
                    window.navigator,
                    "onLine",
                    original,
                );
            }
        }
    });
});
