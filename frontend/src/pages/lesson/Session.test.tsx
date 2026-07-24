import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Session from "./Session";
import type {LearningSession} from "../../types";
import {TestFeatureProvider} from "../../features/testFeatureProvider";
import type {FeatureContext} from "../../features/featureConfig";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
    const actual = await vi.importActual<typeof import("react-router")>(
        "react-router",
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
        // #1126 — the assistant-ui chat surface hydrates prior turns itself on
        // mount (getMessages). Default to an empty history so a new session's
        // welcome empty-state shows; resume tests override per-case.
        apiSessionGetMessages.mockResolvedValue([]);
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

    it("starts a new session and shows the welcome empty-state, never a system bubble", async () => {
        // The system prompt is metadata for the AI orchestrator, never a chat
        // bubble. A new session has no prior turns, so the assistant-ui thread
        // shows its welcome empty-state (which settles after the first
        // subscription tick — hence findByTestId).
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
        // assistant-ui's ``thread.isEmpty`` (which gates the welcome) settles
        // after a subscription tick; under a loaded parallel run that can take
        // longer than the 1s default, so allow more headroom.
        expect(
            await screen.findByTestId("chat-welcome", undefined, {timeout: 4000}),
        ).toBeInTheDocument();
        expect(screen.getByTestId("method-badge-deductive")).toBeInTheDocument();
        expect(screen.getByTestId("cycle-progress")).toBeInTheDocument();
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
        // Chat replays user + assistant turns (the assistant-ui thread hydrates
        // the prior history asynchronously via ``getMessages`` + ``reset`` —
        // #1126), while the system prompt is filtered out of the rendered list.
        expect(
            await screen.findByText("Erkläre mir Quantenfeldtheorie."),
        ).toBeInTheDocument();
        expect(
            await screen.findByText("Quantenfeldtheorie verbindet…"),
        ).toBeInTheDocument();
        expect(
            screen.queryByText("Du bist ein deduktiver Lerncoach."),
        ).not.toBeInTheDocument();
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
