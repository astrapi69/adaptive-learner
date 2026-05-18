import {render, screen, fireEvent} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import SessionChat, {type ChatMessage} from "./SessionChat";

const MESSAGES: ChatMessage[] = [
    {id: "1", role: "system", content: "Du bist ein Lerncoach."},
    {id: "2", role: "user", content: "Ich verstehe X nicht."},
    {id: "3", role: "assistant", content: "Lass uns Schritt fuer Schritt."},
];

describe("SessionChat", () => {
    it("renders one message per item with role-tagged testids", () => {
        render(<SessionChat messages={MESSAGES} onSend={() => {}} />);
        expect(screen.getByTestId("chat-message-system")).toBeInTheDocument();
        expect(screen.getByTestId("chat-message-user")).toBeInTheDocument();
        expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument();
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
});
