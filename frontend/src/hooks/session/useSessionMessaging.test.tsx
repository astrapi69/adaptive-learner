/**
 * useSessionMessaging (#1804).
 *
 * Hook-level pins for the streaming exchange: chunk accumulation +
 * backend-id reconciliation, session/step-evaluation propagation,
 * the cycle-transition card, the friendly no_api_key mapping, and
 * the rollback of both optimistic bubbles on a stream failure.
 * (The page-level rendering of these states stays pinned by
 * Session.test.tsx.)
 */

import {act, renderHook} from "@testing-library/react";
import {useState} from "react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useSessionMessaging} from "./useSessionMessaging";
import {getStorage} from "../../storage";
import {notify} from "../../utils/notify";
import type {ChatMessage} from "../../components/session/SessionChat";
import type {LearningSession} from "../../types";

vi.mock("../../storage", () => ({getStorage: vi.fn()}));
vi.mock("../../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn()},
}));

const t = (_key: string, fallback?: string) => fallback ?? _key;

const SESSION = {
    id: "s-1",
    project_id: "p-1",
    method: "deductive",
    cycle_step: 1,
    status: "active",
} as unknown as LearningSession;

const streamMessage = vi.fn();

interface StreamHandlers {
    onStart?: (userMessage: {id: string; content: string}) => void;
    onChunk: (delta: string) => void;
    onDone: (final: unknown) => void;
}

/** Base successful exchange result the tests specialise per case. */
function exchangeResult(overrides: Record<string, unknown> = {}) {
    return {
        user_message: {id: "u-9", role: "user", content: "hi"},
        assistant_message: {id: "a-9", role: "assistant", content: "hello!"},
        session: {...SESSION, cycle_step: 2},
        step_evaluation: {applied: true, from_step: 1},
        topic_transition: null,
        ai_error: null,
        ai_error_code: null,
        ...overrides,
    };
}

beforeEach(() => {
    vi.mocked(notify.error).mockClear();
    vi.mocked(notify.success).mockClear();
    vi.mocked(notify.info).mockClear();
    streamMessage.mockReset();
    vi.mocked(getStorage).mockReturnValue({
        session: {streamMessage},
    } as unknown as ReturnType<typeof getStorage>);
});

/** Harness owning the shared state the way Session.tsx does. */
function useHarness() {
    const [session, setSession] = useState<LearningSession | null>(SESSION);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const messaging = useSessionMessaging({
        session,
        setSession,
        messages,
        setMessages,
        t,
    });
    return {messaging, messages, session};
}

function streamsTo(result: ReturnType<typeof exchangeResult>) {
    streamMessage.mockImplementation(
        async (_id: string, _body: unknown, handlers: StreamHandlers) => {
            handlers.onStart?.(result.user_message);
            handlers.onChunk("hel");
            handlers.onChunk("lo!");
            handlers.onDone(result);
        },
    );
}

describe("useSessionMessaging.handleSend", () => {
    it("reconciles ids, accumulates chunks, and propagates session + verdict", async () => {
        streamsTo(exchangeResult());
        const {result} = renderHook(useHarness);
        await act(() => result.current.messaging.handleSend("hi"));
        expect(result.current.messages).toEqual([
            {id: "u-9", role: "user", content: "hi"},
            {id: "a-9", role: "assistant", content: "hello!"},
        ]);
        expect(result.current.session?.cycle_step).toBe(2);
        expect(result.current.messaging.stepEvaluation).toEqual({
            applied: true,
            from_step: 1,
        });
        expect(notify.info).toHaveBeenCalled();
        expect(result.current.messaging.sendingMessage).toBe(false);
    });

    it("appends the cycle-transition card when the auto-loop fired", async () => {
        streamsTo(
            exchangeResult({
                topic_transition: {
                    looped: true,
                    new_cycle_count: 2,
                    summary: "Done with greetings.",
                    next_topic: "Numbers",
                },
            }),
        );
        const {result} = renderHook(useHarness);
        await act(() => result.current.messaging.handleSend("hi"));
        expect(result.current.messages.at(-1)).toEqual(
            expect.objectContaining({
                kind: "cycle_transition",
                cycleNumber: 2,
                nextTopic: "Numbers",
            }),
        );
        expect(notify.success).toHaveBeenCalledWith("Cycle 2 started");
    });

    it("maps the no_api_key classification to the friendly message", async () => {
        streamsTo(
            exchangeResult({
                assistant_message: null,
                step_evaluation: null,
                ai_error: "raw provider detail",
                ai_error_code: "no_api_key",
            }),
        );
        const {result} = renderHook(useHarness);
        await act(() => result.current.messaging.handleSend("hi"));
        expect(notify.error).toHaveBeenCalledWith(
            expect.stringContaining("No AI key set."),
        );
        expect(
            result.current.messages.filter((m) => m.role === "assistant"),
        ).toHaveLength(0);
    });

    it("rolls back both optimistic bubbles when the stream fails", async () => {
        streamMessage.mockRejectedValue(new Error("stream broke"));
        const {result} = renderHook(useHarness);
        await act(() => result.current.messaging.handleSend("hi"));
        expect(result.current.messages).toEqual([]);
        expect(notify.error).toHaveBeenCalled();
        expect(result.current.messaging.sendingMessage).toBe(false);
    });
});
