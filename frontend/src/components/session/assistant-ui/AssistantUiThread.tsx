/**
 * assistant-ui adoption: Phase 2 parity (#1126).
 *
 * The assistant-ui Thread wired to the app's session storage via
 * {@link createSessionChatAdapter}. assistant-ui owns the chat UI (composer,
 * streaming bubbles, auto-scroll, a11y, native Enter-to-send); the backend is
 * the app's existing ``getStorage().session.*``, so Dexie browser-direct mode
 * works with no backend, inheriting the #1122 context rebuild.
 *
 * Phase 2 brings the spike to visual + functional parity with the legacy
 * ``SessionChat`` so a later cutover is a swap, not a rewrite:
 *
 *   - **i18n**: composer placeholder + send label + welcome line come from the
 *     shared ``useI18n`` catalog (11 languages), not hardcoded English.
 *   - **Theming**: the thread reuses the SAME token-backed CSS classes as
 *     ``SessionChat`` (``session-chat`` / ``chat-messages`` / ``chat-message`` /
 *     ``chat-message-content-markdown`` / ``chat-input-row``), so every one of
 *     the 6 themes recolors it automatically with no new CSS and no hardcoded
 *     colors.
 *   - **Markdown**: assistant bubbles render via react-markdown + remark-gfm
 *     (the HelpDrawer + LessonViewer pipeline); user text stays verbatim.
 *   - **testid parity**: the composer/list/bubbles carry the same
 *     ``chat-*`` ``data-testid`` selectors the E2E suite already uses, so the
 *     cutover keeps the specs green.
 *
 * Phase 3a adds Voice parity with ``SessionChat``: dictation (``MicButton``)
 * writes into the assistant-ui composer via ``useAui().composer().setText``,
 * and each settled assistant bubble carries a read-aloud ``SpeechButton``. Both
 * buttons hide themselves when the browser lacks Web Speech or the user has the
 * feature off in Settings, so this never renders a broken control.
 *
 * Since the cutover (#2012) this thread is the session chat: ``Session.tsx``
 * mounts it for every session, regular and imported, and the legacy
 * ``SessionChat`` is gone. Domain panels (step-eval, method-switch, XP) are
 * rendered AROUND this thread by ``Session.tsx``.
 *
 * Phase 3b part 2 (#1126): imported-session AI opening. When ``autoOpen`` is set,
 * the thread fires one ``thread.startRun({parentId: null})`` so the AI
 * produces the first lesson question WITHOUT a preceding user bubble (startRun
 * appends no user message); the adapter recognises the run via
 * ``runConfig.custom[OPENING_RUN_FLAG]`` and sends a hidden opening trigger.
 *
 * #3806: one opening per session, not per page load. It fires only while the
 * stored conversation holds no turn; the sent trigger is persisted before the
 * provider call, so a reload, a re-open or a second tab resumes the stored
 * conversation and asks the AI nothing (``session-history``).
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    ActionBarPrimitive,
    AssistantRuntimeProvider,
    ComposerPrimitive,
    MessagePrimitive,
    ThreadPrimitive,
    useAui,
    useAuiState,
    useLocalRuntime,
    type AssistantRuntime,
    type TextMessagePartComponent,
} from "@assistant-ui/react";

import {buttonVariants} from "@/components/ui/button";
import {cn} from "@/lib/utils";

import {useI18n} from "../../../hooks/ui/useI18n";
import {markdownToSpeech} from "../../../lib/lesson/tts-text";
import MarkdownImage from "../../../shared/data-display/MarkdownImage";
import {getStorage} from "../../../storage";
import {notify} from "../../../utils/notify";
import MicButton from "../../voice/MicButton";
import SpeechButton from "../../voice/SpeechButton";
import type {SessionMessageExchangeResult} from "../../../types";
import {formatCycleTransition} from "./cycle-transition";
import {OPENING_RUN_FLAG, createSessionChatAdapter} from "./session-chat-adapter";
import {conversationStarted, visibleTurns} from "./session-history";

interface AssistantUiThreadProps {
    /** LearningSession id the thread streams against. */
    sessionId: string;
    /**
     * #1143 parity: for an imported-chat session, the welcome empty-state
     * names the imported chat's topic (e.g. "Reflexive Verben"). It shows
     * while the thread has no visible turn: before the AI opening arrives, or
     * when an opening's reply never did. ``null``/absent for a regular session.
     */
    introTopic?: string | null;
    /**
     * #1126 Phase 3b: when true (an imported-chat session), the AI opens the
     * conversation on its own with the next lesson question, so the learner
     * doesn't have to type first. #3806: at most one opening run per session,
     * sent only while the stored conversation holds no turn; a reload, a
     * re-open or a second tab resumes what is stored and asks the AI nothing.
     */
    autoOpen?: boolean;
    /**
     * #1126 Phase 4a: domain wiring. Called once per completed turn with the
     * full exchange result so the session shell advances the cycle step,
     * surfaces the step-evaluation verdict, and fires the auto-loop /
     * step-advance toasts (parity with SessionChat's ``handleSend``).
     */
    onExchange?: (result: SessionMessageExchangeResult) => void;
}

/**
 * Assistant text part renderer: react-markdown + remark-gfm with the shared
 * ``chat-message-content-markdown`` typography, so an AI reply reads the same
 * as the help system. An image in a reply is offered as a link when it lives
 * on another host (#3803): a stored reply re-renders on every resume, and the
 * model, not the learner, chose that host.
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
                img: MarkdownImage,
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
    const {t} = useI18n();
    const messageId = useAuiState((s) => s.message.id);
    const isRunning = useAuiState((s) => s.message.status?.type === "running");
    // #3377 - a turn whose stream failed: the runtime marks it incomplete
    // with reason "error". Say so under the (empty or truncated) bubble and
    // offer to send the turn again; the detail goes out as a toast.
    const failed = useAuiState(
        (s) =>
            s.message.status?.type === "incomplete" &&
            s.message.status.reason === "error",
    );
    const text = useAuiState((s) =>
        s.message.content
            .map((part) => (part.type === "text" ? part.text : ""))
            .join(""),
    );

    return (
        <div className="chat-message is-assistant" data-testid="chat-message-assistant">
            <MessagePrimitive.Parts components={{Text: AssistantText}} />
            {failed && (
                <div
                    className="flex flex-wrap items-center gap-2 text-sm text-[var(--error)]"
                    data-testid="chat-reply-error"
                    role="alert"
                >
                    <span>{t("session.reply_failed", "The reply could not be loaded.")}</span>
                    <ActionBarPrimitive.Reload
                        className={cn(buttonVariants({variant: "outline", size: "sm"}))}
                        data-testid="chat-reply-retry"
                    >
                        {t("session.chat_retry", "Try again")}
                    </ActionBarPrimitive.Reload>
                </div>
            )}
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
 * ``ComposerPrimitive.Root`` so ``useAui().composer()`` resolves the thread
 * composer; each transcript (interim + final) overwrites the composer draft,
 * mirroring ``SessionChat``'s ``setDraft`` on ``onTranscript``. The user still
 * presses Send (or Enter) to submit.
 */
function ComposerMic() {
    const aui = useAui();
    return (
        <MicButton
            onTranscript={(text) => aui.composer().setText(text)}
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
                    onError: (error) =>
                        notify.error(
                            tRef.current(
                                "session.reply_failed",
                                "The reply could not be loaded.",
                            ),
                            {error},
                        ),
                    onExchange: (result) => {
                        onExchangeRef.current?.(result);
                        // #1126 Phase 4b-i: cycle-transition parity. On an
                        // auto-loop, append the cycle summary + next topic as an
                        // inline assistant turn (the assistant thread has no
                        // ``messages`` array for the legacy card), preserving the
                        // learning content in the visible conversation.
                        const transition = result.topic_transition;
                        if (transition?.looped && runtimeRef.current) {
                            // Object form with role "assistant" so it is a
                            // STATIC message (no run triggered). The string form
                            // defaults to role "user" and starts a run, which
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

    // Imported-session AI opening (#1126 Phase 3b): ``startRun`` with
    // ``parentId: null`` triggers the adapter with no user message, so the AI's
    // first question appears with no user bubble. #3806: only ``loadHistory``
    // calls this, once the stored conversation is read and holds no turn; the
    // sent trigger is persisted before the provider call, so the next page load
    // finds it and resumes instead of asking again. The ref (keyed by session)
    // keeps it to one run within a page, StrictMode's double effect mount
    // included.
    const openedForSession = useRef<string | null>(null);
    const startOpening = useCallback(() => {
        if (openedForSession.current === sessionId) return;
        openedForSession.current = sessionId;
        runtimeRef.current?.thread.startRun({
            parentId: null,
            runConfig: {custom: {[OPENING_RUN_FLAG]: true}},
        });
    }, [sessionId]);

    // Resume-history hydration (#1126 Phase 4b-i-b): a resumed session must show
    // its prior conversation (the legacy SessionChat rendered the full history
    // on resume; the assistant thread otherwise starts empty). Load the
    // persisted turns once per session and seed the runtime via
    // ``thread.reset``; ``visibleTurns`` drops the system prompt (orchestrator
    // metadata) and the hidden opening trigger. A new session seeds nothing, so
    // the welcome empty-state stays. #3806: imported sessions resume the same
    // way instead of opening clean, and their opening waits for this read, so a
    // history that cannot be read sends nothing. A failed load says so and
    // offers a retry instead of the fresh welcome, which reads as deleted
    // history (#3377). Ref-guarded (once per session, StrictMode-safe).
    const [historyFailed, setHistoryFailed] = useState(false);
    const loadHistory = useCallback(() => {
        setHistoryFailed(false);
        getStorage()
            .session.getMessages(sessionId)
            .then((history) => {
                const prior = visibleTurns(history);
                if (prior.length > 0) runtimeRef.current?.thread.reset(prior);
                if (autoOpen && !conversationStarted(history)) startOpening();
            })
            .catch(() => setHistoryFailed(true));
    }, [sessionId, autoOpen, startOpening]);
    const hydratedForSession = useRef<string | null>(null);
    useEffect(() => {
        if (hydratedForSession.current === sessionId) return;
        hydratedForSession.current = sessionId;
        loadHistory();
    }, [sessionId, loadHistory]);

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <ThreadPrimitive.Root className="session-chat" data-testid="session-chat">
                <ThreadPrimitive.Viewport className="chat-messages" data-testid="chat-messages">
                    <ThreadPrimitive.Empty>
                        {historyFailed ? (
                            <div
                                className="flex flex-col items-center gap-3 px-4 py-6 text-center text-[var(--fg-muted)]"
                                data-testid="chat-history-error"
                                role="alert"
                            >
                                <span>
                                    {t(
                                        "session.history_failed",
                                        "The earlier conversation could not be loaded. Nothing was deleted.",
                                    )}
                                </span>
                                <button
                                    type="button"
                                    className={cn(buttonVariants({variant: "outline", size: "sm"}))}
                                    data-testid="chat-history-retry"
                                    onClick={loadHistory}
                                >
                                    {t("session.chat_retry", "Try again")}
                                </button>
                            </div>
                        ) : (
                            <div
                                className="chat-welcome px-4 py-6 text-center italic text-[var(--fg-muted)]"
                                data-testid="chat-welcome"
                            >
                                {introTopic ? (
                                    <>
                                        <div data-testid="chat-intro-topic">
                                            {t("session.topic_label", "Topic")}: {introTopic}
                                        </div>
                                        <div className="mt-2">
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
                        )}
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
                        className={cn(buttonVariants(), "max-[769px]:min-w-16")}
                        data-testid="chat-send"
                    >
                        {t("session.send_message", "Send")}
                    </ComposerPrimitive.Send>
                </ComposerPrimitive.Root>
            </ThreadPrimitive.Root>
        </AssistantRuntimeProvider>
    );
}
