import {render, screen, fireEvent} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import SessionChat, {type ChatMessage} from "./SessionChat";

const MESSAGES: ChatMessage[] = [
    {id: "1", role: "system", content: "Du bist ein Lerncoach."},
    {id: "2", role: "user", content: "Ich verstehe X nicht."},
    {id: "3", role: "assistant", content: "Lass uns Schritt fuer Schritt."},
];

describe("SessionChat", () => {
    it("renders user + assistant bubbles but HIDES system-prompt metadata", () => {
        // v1.23.1 / Bug 7 follow-up — system messages are
        // metadata for the AI orchestrator, not user-facing
        // content. Pre-v1.23.1 they rendered as the first
        // chat bubble; the resume-session flow surfaced this
        // as a "wizard/setup" UX smell. The filter belongs
        // in the chat surface (presentation layer); the
        // upstream messages array still carries the system
        // entry so the next /message POST sees the
        // chronological history.
        render(<SessionChat messages={MESSAGES} onSend={() => {}} />);
        expect(
            screen.queryByTestId("chat-message-system"),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("chat-message-user")).toBeInTheDocument();
        expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument();
    });

    it("shows the welcome empty-state when only the system prompt is in history", () => {
        // Resume-mode pre-first-exchange: backend returns a
        // single system row; the chat must NOT render that
        // row but instead surface a friendly welcome line so
        // the user understands the chat is empty by design.
        const onlySystem: ChatMessage[] = [
            {id: "1", role: "system", content: "Du bist ein Lerncoach."},
        ];
        render(<SessionChat messages={onlySystem} onSend={() => {}} />);
        expect(screen.getByTestId("chat-welcome")).toBeInTheDocument();
        expect(
            screen.queryByTestId("chat-message-system"),
        ).not.toBeInTheDocument();
    });

    it("does NOT show the welcome empty-state once a user message exists", () => {
        render(<SessionChat messages={MESSAGES} onSend={() => {}} />);
        expect(
            screen.queryByTestId("chat-welcome"),
        ).not.toBeInTheDocument();
    });

    it("disables send when the draft is empty", () => {
        render(<SessionChat messages={MESSAGES} onSend={() => {}} />);
        const send = screen.getByTestId("chat-send") as HTMLButtonElement;
        expect(send.disabled).toBe(true);
    });

    it("fires onSend with the trimmed draft and clears the input", () => {
        const onSend = vi.fn();
        render(<SessionChat messages={MESSAGES} onSend={onSend} />);
        const input = screen.getByTestId("chat-input") as HTMLTextAreaElement;
        fireEvent.change(input, {target: {value: "   Frage   "}});
        const send = screen.getByTestId("chat-send") as HTMLButtonElement;
        expect(send.disabled).toBe(false);
        fireEvent.click(send);
        expect(onSend).toHaveBeenCalledWith("Frage");
        expect(input.value).toBe("");
    });

    it("does not fire when disabled", () => {
        const onSend = vi.fn();
        render(<SessionChat messages={MESSAGES} onSend={onSend} disabled />);
        const input = screen.getByTestId("chat-input") as HTMLTextAreaElement;
        fireEvent.change(input, {target: {value: "Frage"}});
        const send = screen.getByTestId("chat-send") as HTMLButtonElement;
        expect(send.disabled).toBe(true);
        fireEvent.click(send);
        expect(onSend).not.toHaveBeenCalled();
    });

    // Phase 39 C2 — WCAG SC 2.4.3 (Focus Order). The textarea is
    // the page's primary action; it must hold focus on first
    // mount so a keyboard-only user can type immediately.
    it("focuses the textarea on first mount", () => {
        render(<SessionChat messages={MESSAGES} onSend={() => {}} />);
        const input = screen.getByTestId("chat-input") as HTMLTextAreaElement;
        expect(document.activeElement).toBe(input);
    });

    it("does NOT auto-focus when the chat is disabled", () => {
        render(<SessionChat messages={MESSAGES} onSend={() => {}} disabled />);
        const input = screen.getByTestId("chat-input") as HTMLTextAreaElement;
        expect(document.activeElement).not.toBe(input);
    });

    it("renders a streaming assistant message with a cursor + dedicated testid", () => {
        const streaming: ChatMessage[] = [
            ...MESSAGES,
            {
                id: "streaming-1",
                role: "assistant",
                content: "partial reply so",
                streaming: true,
            },
        ];
        render(<SessionChat messages={streaming} onSend={() => {}} />);
        // Streaming bubble exposes a distinct testid so consumers can
        // pin "is the streaming bubble visible?" without parsing
        // class names.
        const node = screen.getByTestId("chat-message-assistant-streaming");
        expect(node).toBeInTheDocument();
        // Cursor character lives inside the bubble.
        expect(node.textContent).toContain("partial reply so");
        expect(node.textContent).toContain("▍"); // ▍
    });
});
