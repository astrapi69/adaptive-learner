/**
 * assistant-ui Phase 3b part 2 (#1126): imported-session AI opening.
 *
 * The hard guardrail: the synthetic opening trigger must NEVER appear as a user
 * bubble: the thread must look as if the AI began on its own. This drives the
 * real thread with ``autoOpen`` against a streaming storage mock and asserts an
 * assistant bubble appears while NO user bubble is ever rendered.
 */

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const {streamMessage, getMessages} = vi.hoisted(() => ({
    streamMessage: vi.fn(),
    getMessages: vi.fn(),
}));
vi.mock("../../../storage", () => ({
    getStorage: () => ({session: {streamMessage, getMessages}}),
}));

import AssistantUiThread from "./AssistantUiThread";
import {OPENING_TRIGGER} from "./session-chat-adapter";

/** A new session has only its system prompt on record. */
const SYSTEM_ROW = {id: "s", role: "system", content: "system prompt"};
const TRIGGER_ROW = {id: "t", role: "user", content: OPENING_TRIGGER};

/** Let a stray opening run reach the storage mock before asserting none did. */
async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 20));
}

describe("AssistantUiThread AI opening (Phase 3b part 2, #1126)", () => {
    beforeEach(() => {
        streamMessage.mockReset();
        getMessages.mockReset();
        getMessages.mockResolvedValue([SYSTEM_ROW]);
    });

    it("opens with an assistant bubble and NEVER a user bubble", async () => {
        streamMessage.mockImplementation(async (...args: unknown[]) => {
            const handlers = args[2] as
                | {onChunk: (d: string) => void; onDone: (r: unknown) => void}
                | undefined;
            if (!handlers) return;
            handlers.onChunk("Willkommen! Erste Frage: …");
            handlers.onDone({});
        });

        render(<AssistantUiThread sessionId="sess-1" autoOpen introTopic="Reflexive Verben" />);

        // The AI opening streams into an assistant bubble. Since
        // @assistant-ui/react 0.15.16 the streamed chunk is flushed a tick
        // AFTER the bubble mounts, so the text assertion polls instead of
        // reading synchronously - same user-visible property, no timing bet.
        const assistant = await screen.findByTestId("chat-message-assistant");
        await waitFor(() =>
            expect(assistant).toHaveTextContent("Willkommen! Erste Frage:"),
        );

        // Guardrail: the hidden trigger never surfaces as a user bubble.
        expect(screen.queryByTestId("chat-message-user")).not.toBeInTheDocument();

        // The backend was asked to open exactly once.
        await waitFor(() => expect(streamMessage).toHaveBeenCalledTimes(1));
    });

    it("does NOT auto-open a regular (non-imported) session", async () => {
        render(<AssistantUiThread sessionId="sess-2" />);
        // No opening run fired; the welcome empty-state stays.
        expect(await screen.findByTestId("chat-welcome")).toBeInTheDocument();
        expect(streamMessage).not.toHaveBeenCalled();
    });

    it("appends the cycle summary inline on an auto-loop (#1126 Phase 4b-i parity)", async () => {
        // The completed turn reports a looped transition; the thread must show
        // the cycle summary + next topic as a SECOND assistant turn inline, not
        // drop it to a bare toast.
        streamMessage.mockImplementation(async (...args: unknown[]) => {
            const handlers = args[2] as
                | {
                      onChunk: (d: string) => void;
                      onDone: (r: unknown) => void;
                  }
                | undefined;
            if (!handlers) return;
            handlers.onChunk("Erste Frage?");
            handlers.onDone({
                session: {cycle_step: 1},
                step_evaluation: null,
                topic_transition: {
                    looped: true,
                    new_cycle_count: 2,
                    summary: "Du hast reflexive Verben geübt.",
                    next_topic: "Modalverben",
                    next_topic_rationale: "",
                },
            });
        });

        render(<AssistantUiThread sessionId="sess-1" autoOpen />);

        // The opening reply is there …
        expect(await screen.findByText(/Erste Frage\?/)).toBeInTheDocument();
        // … and the auto-loop summary + next topic landed inline.
        expect(
            await screen.findByText(/Du hast reflexive Verben geübt\./),
        ).toBeInTheDocument();
        expect(await screen.findByText(/Modalverben/)).toBeInTheDocument();
    });
});

describe("AssistantUiThread opens once per session (#3806)", () => {
    beforeEach(() => {
        streamMessage.mockReset();
        // A stray call must fail the assertion, not crash in the adapter.
        streamMessage.mockResolvedValue(undefined);
        getMessages.mockReset();
    });

    it("does not open again when the opening is on record (reload, re-open, second tab)", async () => {
        getMessages.mockResolvedValue([
            SYSTEM_ROW,
            TRIGGER_ROW,
            {id: "a1", role: "assistant", content: "Erste Frage: Was braucht eine Pflanze?"},
        ]);

        render(<AssistantUiThread sessionId="sess-1" autoOpen introTopic="Photosynthese" />);

        expect(await screen.findByText(/Erste Frage: Was braucht eine Pflanze\?/)).toBeInTheDocument();
        await settle();
        expect(streamMessage).not.toHaveBeenCalled();
        expect(screen.queryByTestId("chat-message-user")).not.toBeInTheDocument();
    });

    it("does not resend an opening whose reply never arrived", async () => {
        // The trigger is persisted before the provider call, so a failed
        // opening is on record too: the learner gets the welcome, not a
        // second request carrying the transcript.
        getMessages.mockResolvedValue([SYSTEM_ROW, TRIGGER_ROW]);

        render(<AssistantUiThread sessionId="sess-1" autoOpen introTopic="Photosynthese" />);

        expect(await screen.findByTestId("chat-intro-topic")).toHaveTextContent("Photosynthese");
        await settle();
        expect(streamMessage).not.toHaveBeenCalled();
    });

    it("does not open while the stored conversation cannot be read; the retry decides again", async () => {
        getMessages.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([SYSTEM_ROW]);
        streamMessage.mockImplementation(async (...args: unknown[]) => {
            const handlers = args[2] as
                | {onChunk: (d: string) => void; onDone: (r: unknown) => void}
                | undefined;
            if (!handlers) return;
            handlers.onChunk("Erste Frage?");
            handlers.onDone({});
        });

        render(<AssistantUiThread sessionId="sess-1" autoOpen />);

        const retry = await screen.findByTestId("chat-history-retry");
        await settle();
        expect(streamMessage).not.toHaveBeenCalled();

        fireEvent.click(retry);
        expect(await screen.findByText(/Erste Frage\?/)).toBeInTheDocument();
        await waitFor(() => expect(streamMessage).toHaveBeenCalledTimes(1));
    });
});
