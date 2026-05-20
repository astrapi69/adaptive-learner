import {useEffect, useRef, useState, type FormEvent} from "react";

import {useI18n} from "../hooks/useI18n";
import type {MessageRole} from "../lib/constants";

export interface ChatMessage {
    /** Unique id for React key purposes. Backend-issued where available;
     *  optimistic local entries get a synthetic ``local-<n>`` id. */
    id: string;
    role: MessageRole;
    content: string;
    /**
     * v1.4.0 — auto-loop transition card. When set, the chat
     * renders this message with a dedicated style (border,
     * cycle counter badge) instead of a regular speech bubble.
     */
    kind?: "cycle_transition";
    /** v1.4.0 — auto-loop cycle counter shown on the card. */
    cycleNumber?: number;
    /** v1.4.0 — next-cycle topic shown beneath the summary. */
    nextTopic?: string;
    /**
     * v1.6.0 — streaming state. ``true`` while SSE deltas are
     * still being appended to ``content``; the chat renders a
     * trailing cursor (▍) inside the bubble until the stream
     * settles.
     */
    streaming?: boolean;
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
                {messages.map((msg) => {
                    if (msg.kind === "cycle_transition") {
                        return (
                            <div
                                key={msg.id}
                                className="chat-transition-card"
                                data-testid="chat-cycle-transition"
                            >
                                <div className="chat-transition-header">
                                    <span className="chat-transition-badge">
                                        {t(
                                            "session.cycle_label",
                                            "Cycle {n}",
                                        ).replace(
                                            "{n}",
                                            String(msg.cycleNumber ?? 1),
                                        )}
                                    </span>
                                </div>
                                <p className="chat-transition-summary">
                                    {msg.content}
                                </p>
                                {msg.nextTopic && (
                                    <p className="chat-transition-next">
                                        <strong>
                                            {t(
                                                "session.next_topic",
                                                "Next topic:",
                                            )}
                                        </strong>{" "}
                                        {msg.nextTopic}
                                    </p>
                                )}
                            </div>
                        );
                    }
                    return (
                        <div
                            key={msg.id}
                            className={`chat-message is-${msg.role}${
                                msg.streaming ? " is-streaming" : ""
                            }`}
                            data-testid={
                                msg.streaming
                                    ? `chat-message-${msg.role}-streaming`
                                    : `chat-message-${msg.role}`
                            }
                        >
                            <pre className="chat-message-content">
                                {msg.content}
                                {msg.streaming && (
                                    <span
                                        className="chat-message-cursor"
                                        aria-hidden="true"
                                    >
                                        ▍
                                    </span>
                                )}
                            </pre>
                        </div>
                    );
                })}
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
