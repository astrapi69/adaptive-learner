/**
 * assistant-ui Phase 3b part 2 (#1126): imported-session AI opening.
 *
 * The hard guardrail: the synthetic opening trigger must NEVER appear as a user
 * bubble — the thread must look as if the AI began on its own. This drives the
 * real thread with ``autoOpen`` against a streaming storage mock and asserts an
 * assistant bubble appears while NO user bubble is ever rendered.
 */

import {render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const {streamMessage} = vi.hoisted(() => ({streamMessage: vi.fn()}));
vi.mock("../../../storage", () => ({
    getStorage: () => ({session: {streamMessage}}),
}));

import AssistantUiThread from "./AssistantUiThread";

describe("AssistantUiThread AI opening (Phase 3b part 2, #1126)", () => {
    beforeEach(() => streamMessage.mockReset());

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

        // The AI opening streams into an assistant bubble.
        const assistant = await screen.findByTestId("chat-message-assistant");
        expect(assistant).toHaveTextContent("Willkommen! Erste Frage:");

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
        // the cycle summary + next topic as a SECOND assistant turn inline — not
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
