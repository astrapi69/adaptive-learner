import {useEffect, useRef, useState, type FormEvent, type KeyboardEvent} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {useButtonTooltips} from "../../hooks/settings/useButtonTooltips";
import {useI18n} from "../../hooks/ui/useI18n";
import type {MessageRole} from "../../lib/constants";
import MicButton from "../voice/MicButton";
import SpeechButton from "../voice/SpeechButton";
import {markdownToSpeech} from "../../lib/lesson/tts-text";

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
    const tooltipsOn = useButtonTooltips();
    const [draft, setDraft] = useState("");
    const listRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages]);

    // WCAG SC 2.4.3 (Focus Order) + general keyboard UX: the
    // textarea is the primary action on this page; focus it
    // on first mount so a keyboard user can type immediately.
    // Subsequent re-renders keep the user's current focus.
    useEffect(() => {
        if (!disabled) inputRef.current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submit = () => {
        const trimmed = draft.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setDraft("");
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        submit();
    };

    // Enter sends the message; Shift+Enter inserts a newline (standard chat
    // composer behaviour). A <textarea> never submits its form on Enter on its
    // own, so this is what makes the keyboard send work.
    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
        }
    };

    // v1.23.1 / Bug 7 follow-up — the system-prompt message
    // is metadata for the AI orchestrator, NOT user-facing
    // content. Pre-v1.23.1 it rendered as the first chat
    // bubble (e.g. "Du bist ein Lerncoach..."), which felt
    // like a wizard/setup screen to users — particularly on
    // session-resume where the user expected to see their
    // prior conversation. We hide it from the rendered list
    // while keeping it in the underlying state so the
    // backend's next /message call still sees the
    // chronological history.
    const visibleMessages = messages.filter((m) => m.role !== "system");
    const hasOnlySystemPrompt =
        visibleMessages.length === 0 && messages.length > 0;

    return (
        <div className="session-chat" data-testid="session-chat">
            <div className="chat-messages" ref={listRef} data-testid="chat-messages">
                {hasOnlySystemPrompt && (
                    <div
                        className="chat-welcome"
                        data-testid="chat-welcome"
                        style={{
                            padding: "1.5rem 1rem",
                            textAlign: "center",
                            color: "var(--fg-muted)",
                            fontStyle: "italic",
                        }}
                    >
                        {t(
                            "session.welcome_empty",
                            "Ready to learn! Write your first message.",
                        )}
                    </div>
                )}
                {visibleMessages.map((msg) => {
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
                            {/* v1.35.0 / UX-fix — assistant
                                messages render as Markdown
                                (bold, lists, tables, code with
                                the same react-markdown + remark-
                                gfm pipeline HelpDrawer +
                                LessonViewer use). User messages
                                stay as-typed in a <pre> so the
                                user sees their input verbatim.
                                Streaming bubbles render Markdown
                                progressively; react-markdown
                                renders partial trees cleanly. */}
                            {msg.role === "assistant" ? (
                                <div
                                    className="chat-message-content chat-message-content-markdown"
                                    data-testid="chat-message-content-markdown"
                                >
                                    <Markdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            table: ({node: _n, ...tableProps}) => (
                                                <div className="chat-message-table-wrapper">
                                                    <table {...tableProps} />
                                                </div>
                                            ),
                                        }}
                                    >
                                        {msg.content}
                                    </Markdown>
                                    {msg.streaming && (
                                        <span
                                            className="chat-message-cursor"
                                            aria-hidden="true"
                                        >
                                            ▍
                                        </span>
                                    )}
                                </div>
                            ) : (
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
                            )}
                            {/* v1.18.0 / Phase 31A — TTS on assistant
                                bubbles only. The button hides itself
                                when speechSynthesis is unavailable or
                                Settings has TTS off. Streaming bubbles
                                don't get a button until the stream
                                settles. */}
                            {msg.role === "assistant" && !msg.streaming && (
                                <div className="chat-message-actions">
                                    <SpeechButton
                                        text={markdownToSpeech(msg.content)}
                                        testId={`assistant-${msg.id}`}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <form className="chat-input-row" onSubmit={handleSubmit}>
                <textarea
                    ref={inputRef}
                    data-testid="chat-input"
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        placeholder ??
                        t("session.message_placeholder", "Write your reply…")
                    }
                    disabled={disabled}
                />
                {/* v1.18.0 / Phase 31B — dictation. Hides itself
                    when SpeechRecognition is unavailable or
                    Settings has STT off. */}
                <MicButton
                    onTranscript={(text, isFinal) => {
                        // Interim results overwrite the in-flight
                        // draft so the user sees their phrase build
                        // up. Final commits the same way — the
                        // user can edit before sending.
                        setDraft(text);
                        // ``isFinal`` is intentionally unused: we
                        // treat interim + final identically for the
                        // input-field display. The Send button
                        // remains the explicit submit.
                        void isFinal;
                    }}
                    testId="session-input"
                />
                <button
                    type="submit"
                    className="btn btn-primary"
                    data-testid="chat-send"
                    disabled={disabled || draft.trim().length === 0}
                    aria-label={t("ui.tooltips.send_message", "Send message")}
                    title={
                        tooltipsOn
                            ? t("ui.tooltips.send_message", "Send message")
                            : undefined
                    }
                >
                    {t("session.send_message", "Send")}
                </button>
            </form>
        </div>
    );
}
