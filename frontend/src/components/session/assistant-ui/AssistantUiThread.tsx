/**
 * assistant-ui adoption — Phase 2 parity (#1126).
 *
 * The assistant-ui Thread wired to the app's session storage via
 * {@link createSessionChatAdapter}. assistant-ui owns the chat UI (composer,
 * streaming bubbles, auto-scroll, a11y, native Enter-to-send); the backend is
 * the app's existing ``getStorage().session.*`` — so Dexie browser-direct mode
 * works with no backend, inheriting the #1122 context rebuild.
 *
 * Phase 2 brings the spike to visual + functional parity with the legacy
 * ``SessionChat`` so a later cutover is a swap, not a rewrite:
 *
 *   - **i18n** — composer placeholder + send label + welcome line come from the
 *     shared ``useI18n`` catalog (11 languages), not hardcoded English.
 *   - **Theming** — the thread reuses the SAME token-backed CSS classes as
 *     ``SessionChat`` (``session-chat`` / ``chat-messages`` / ``chat-message`` /
 *     ``chat-message-content-markdown`` / ``chat-input-row``), so every one of
 *     the 6 themes recolors it automatically with no new CSS and no hardcoded
 *     colors.
 *   - **Markdown** — assistant bubbles render via react-markdown + remark-gfm
 *     (the HelpDrawer + LessonViewer pipeline); user text stays verbatim.
 *   - **testid parity** — the composer/list/bubbles carry the same
 *     ``chat-*`` ``data-testid`` selectors the E2E suite already uses, so the
 *     cutover keeps the specs green.
 *
 * Phase 3a adds Voice parity with ``SessionChat``: dictation (``MicButton``)
 * writes into the assistant-ui composer via ``useComposerRuntime().setText``,
 * and each settled assistant bubble carries a read-aloud ``SpeechButton``. Both
 * buttons hide themselves when the browser lacks Web Speech or the user has the
 * feature off in Settings, so this never renders a broken control.
 *
 * Still mounted only behind the opt-in ``?ui=assistant`` flag; the default
 * Session path renders the unchanged ``SessionChat``. Domain panels (step-eval,
 * method-switch, XP) are rendered AROUND this thread by ``Session.tsx`` and are
 * shared with the legacy surface.
 *
 * Phase 3b part 2 (#1126): imported-session AI opening. When ``autoOpen`` is set,
 * the thread fires one ``thread.startRun({parentId: null})`` on init so the AI
 * produces the first lesson question WITHOUT a preceding user bubble (startRun
 * appends no user message); the adapter recognises the run via
 * ``runConfig.custom[OPENING_RUN_FLAG]`` and sends a hidden opening trigger.
 */

import {useEffect, useMemo, useRef} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    AssistantRuntimeProvider,
    ComposerPrimitive,
    MessagePrimitive,
    ThreadPrimitive,
    useComposerRuntime,
    useLocalRuntime,
    useMessage,
    type AssistantRuntime,
    type TextMessagePartComponent,
} from "@assistant-ui/react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {markdownToSpeech} from "../../../lib/lesson/tts-text";
import MicButton from "../../voice/MicButton";
import SpeechButton from "../../voice/SpeechButton";
import type {SessionMessageExchangeResult} from "../../../types";
import {formatCycleTransition} from "./cycle-transition";
import {OPENING_RUN_FLAG, createSessionChatAdapter} from "./session-chat-adapter";

interface AssistantUiThreadProps {
    /** LearningSession id the thread streams against. */
    sessionId: string;
    /**
     * #1143 parity — for an imported-chat session, the welcome empty-state
     * names the imported chat's topic (e.g. "Reflexive Verben"). The
     * assistant-ui thread already opens clean (it loads no prior history), so
     * this is the only imported-session cue it needs. ``null``/absent for a
     * regular session.
     */
    introTopic?: string | null;
    /**
     * #1126 Phase 3b — when true (an imported-chat session), the AI opens the
     * conversation on its own with the next lesson question, so the learner
     * doesn't have to type first. Fires exactly one opening run per session.
     */
    autoOpen?: boolean;
    /**
     * #1126 Phase 4a — domain wiring. Called once per completed turn with the
     * full exchange result so the session shell advances the cycle step,
     * surfaces the step-evaluation verdict, and fires the auto-loop /
     * step-advance toasts (parity with SessionChat's ``handleSend``).
     */
    onExchange?: (result: SessionMessageExchangeResult) => void;
}

/**
 * Assistant text part renderer. Mirrors ``SessionChat``'s assistant bubble:
 * react-markdown + remark-gfm with the shared ``chat-message-content-markdown``
 * typography, so an AI reply reads the same as the help system.
 */
const AssistantText: TextMessagePartComponent = ({text}) => (
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
            {text}
        </Markdown>
    </div>
);

/**
 * User text part renderer. Kept verbatim in a ``<pre>`` (as-typed), matching
 * ``SessionChat`` so the learner sees exactly what they sent.
 */
const UserText: TextMessagePartComponent = ({text}) => (
    <pre className="chat-message-content">{text}</pre>
);

function UserMessage() {
    return (
        <div className="chat-message is-user" data-testid="chat-message-user">
            <MessagePrimitive.Parts components={{Text: UserText}} />
        </div>
    );
}

function AssistantMessage() {
    // Read-aloud parity with SessionChat: the TTS button reads the whole
    // assistant turn, so it needs the message's joined text and must wait until
    // the stream settles (no button on a still-running bubble). Both come from
    // the message store, not the per-part Text renderer.
    const messageId = useMessage((message) => message.id);
    const isRunning = useMessage((message) => message.status?.type === "running");
    const text = useMessage((message) =>
        message.content
            .map((part) => (part.type === "text" ? part.text : ""))
            .join(""),
    );

    return (
        <div className="chat-message is-assistant" data-testid="chat-message-assistant">
            <MessagePrimitive.Parts components={{Text: AssistantText}} />
            {!isRunning && text.trim().length > 0 && (
                <div className="chat-message-actions">
                    <SpeechButton
                        text={markdownToSpeech(text)}
                        testId={`assistant-${messageId}`}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Dictation control for the assistant-ui composer. Lives inside
 * ``ComposerPrimitive.Root`` so ``useComposerRuntime`` resolves the thread
 * composer; each transcript (interim + final) overwrites the composer draft,
 * mirroring ``SessionChat``'s ``setDraft`` on ``onTranscript``. The user still
 * presses Send (or Enter) to submit.
 */
function ComposerMic() {
    const composer = useComposerRuntime();
    return (
        <MicButton
            onTranscript={(text) => composer.setText(text)}
            testId="session-input"
        />
    );
}

/**
 * Render the assistant-ui Thread for one session. Wrap in
 * ``AssistantRuntimeProvider`` with a local runtime backed by our adapter.
 */
export default function AssistantUiThread({
    sessionId,
    introTopic,
    autoOpen = false,
    onExchange,
}: AssistantUiThreadProps) {
    const {t} = useI18n();
    // Keep the adapter memo stable per session while always invoking the latest
    // onExchange (which closes over fresh session/step state each render) and
    // reading the latest runtime/t (assigned after useLocalRuntime, below).
    const onExchangeRef = useRef(onExchange);
    onExchangeRef.current = onExchange;
    const runtimeRef = useRef<AssistantRuntime | null>(null);
    const tRef = useRef(t);
    tRef.current = t;
    const runtime = useLocalRuntime(
        useMemo(
            () =>
                createSessionChatAdapter(sessionId, {
                    onExchange: (result) => {
                        onExchangeRef.current?.(result);
                        // #1126 Phase 4b-i — cycle-transition parity. On an
                        // auto-loop, append the cycle summary + next topic as an
                        // inline assistant turn (the assistant thread has no
                        // ``messages`` array for the legacy card), preserving the
                        // learning content in the visible conversation.
                        const transition = result.topic_transition;
                        if (transition?.looped && runtimeRef.current) {
                            // Object form with role "assistant" so it is a
                            // STATIC message (no run triggered). The string form
                            // defaults to role "user" and starts a run — which
                            // would both show a user bubble and loop.
                            runtimeRef.current.thread.append({
                                role: "assistant",
                                content: [
                                    {
                                        type: "text",
                                        text: formatCycleTransition(
                                            transition,
                                            tRef.current,
                                        ),
                                    },
                                ],
                            });
                        }
                    },
                }),
            [sessionId],
        ),
    );
    runtimeRef.current = runtime;

    // Imported-session AI opening (#1126 Phase 3b): fire ONE opening run per
    // session. ``startRun`` with ``parentId: null`` triggers the adapter with no
    // user message, so the AI's first question appears with no user bubble. The
    // ref (keyed by session) guards against React StrictMode's double effect
    // mount so the opening never fires twice.
    const openedForSession = useRef<string | null>(null);
    useEffect(() => {
        if (!autoOpen) return;
        if (openedForSession.current === sessionId) return;
        openedForSession.current = sessionId;
        runtime.thread.startRun({
            parentId: null,
            runConfig: {custom: {[OPENING_RUN_FLAG]: true}},
        });
    }, [autoOpen, sessionId, runtime]);

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <ThreadPrimitive.Root className="session-chat" data-testid="session-chat">
                <ThreadPrimitive.Viewport className="chat-messages" data-testid="chat-messages">
                    <ThreadPrimitive.Empty>
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
                            {introTopic ? (
                                <>
                                    <div data-testid="chat-intro-topic">
                                        {t("session.topic_label", "Topic")}: {introTopic}
                                    </div>
                                    <div style={{marginTop: "0.5rem"}}>
                                        {t(
                                            "session.welcome_empty",
                                            "Ready to learn! Write your first message.",
                                        )}
                                    </div>
                                </>
                            ) : (
                                t(
                                    "session.welcome_empty",
                                    "Ready to learn! Write your first message.",
                                )
                            )}
                        </div>
                    </ThreadPrimitive.Empty>
                    <ThreadPrimitive.Messages
                        components={{
                            UserMessage,
                            AssistantMessage,
                        }}
                    />
                </ThreadPrimitive.Viewport>
                <ComposerPrimitive.Root className="chat-input-row">
                    <ComposerPrimitive.Input
                        rows={2}
                        data-testid="chat-input"
                        placeholder={t("session.message_placeholder", "Write your reply…")}
                    />
                    <ComposerMic />
                    <ComposerPrimitive.Send
                        className="btn btn-primary"
                        data-testid="chat-send"
                    >
                        {t("session.send_message", "Send")}
                    </ComposerPrimitive.Send>
                </ComposerPrimitive.Root>
            </ThreadPrimitive.Root>
        </AssistantRuntimeProvider>
    );
}
