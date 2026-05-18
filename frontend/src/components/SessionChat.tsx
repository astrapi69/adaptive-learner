import {useEffect, useRef, useState, type FormEvent} from "react";

import {useI18n} from "../hooks/useI18n";
import type {MessageRole} from "../lib/constants";

export interface ChatMessage {
    /** Unique id for React key purposes. Backend-issued where available;
     *  optimistic local entries get a synthetic ``local-<n>`` id. */
    id: string;
    role: MessageRole;
    content: string;
}

interface SessionChatProps {
    messages: ChatMessage[];
    onSend: (content: string) => void;
    disabled?: boolean;
    /** Optional placeholder override for the textarea. */
    placeholder?: string;
}

/**
 * Pure presentational chat surface. The parent (``Session.tsx``)
 * owns the messages array + does the API roundtrip on
 * ``onSend``. This component just renders, autosizes scroll, and
 * fires onSend with the trimmed text.
 */
export default function SessionChat({
    messages,
    onSend,
    disabled = false,
    placeholder,
}: SessionChatProps) {
    const {t} = useI18n();
    const [draft, setDraft] = useState("");
    const listRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setDraft("");
    };

    return (
        <div className="session-chat" data-testid="session-chat">
            <div className="chat-messages" ref={listRef} data-testid="chat-messages">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`chat-message is-${msg.role}`}
                        data-testid={`chat-message-${msg.role}`}
                    >
                        <pre className="chat-message-content">{msg.content}</pre>
                    </div>
                ))}
            </div>
            <form className="chat-input-row" onSubmit={handleSubmit}>
                <textarea
                    data-testid="chat-input"
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                        placeholder ??
                        t("session.message_placeholder", "Write your reply…")
                    }
                    disabled={disabled}
                />
                <button
                    type="submit"
                    className="btn btn-primary"
                    data-testid="chat-send"
                    disabled={disabled || draft.trim().length === 0}
                >
                    {t("session.send_message", "Send")}
                </button>
            </form>
        </div>
    );
}
