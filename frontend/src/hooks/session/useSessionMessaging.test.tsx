/**
 * useSessionMessaging (#1804; slimmed at the #1126 cutover).
 *
 * Hook-level pins for ``applyExchangeOutcome`` — the domain handling the
 * assistant-ui thread calls once per completed turn: cycle-step advance +
 * step-evaluation propagation, the step-advance + auto-loop toasts, and the
 * friendly no_api_key mapping. (The chat surface owns its own message list, so
 * there is no streaming/rollback here anymore.)
 */

import {act, renderHook} from "@testing-library/react";
import {useState} from "react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useSessionMessaging} from "./useSessionMessaging";
import {notify} from "../../utils/notify";
import type {LearningSession, SessionMessageExchangeResult} from "../../types";

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

/** Base successful exchange result the tests specialise per case. */
function exchangeResult(
    overrides: Record<string, unknown> = {},
): SessionMessageExchangeResult {
    return {
        user_message: {id: "u-9", role: "user", content: "hi"},
        assistant_message: {id: "a-9", role: "assistant", content: "hello!"},
        session: {...SESSION, cycle_step: 2},
        step_evaluation: {applied: true, from_step: 1},
        topic_transition: null,
        ai_error: null,
        ai_error_code: null,
        ...overrides,
    } as unknown as SessionMessageExchangeResult;
}

beforeEach(() => {
    vi.mocked(notify.error).mockClear();
    vi.mocked(notify.success).mockClear();
    vi.mocked(notify.info).mockClear();
});

/** Harness owning ``session`` the way Session.tsx does. */
function useHarness() {
    const [session, setSession] = useState<LearningSession | null>(SESSION);
    const messaging = useSessionMessaging({setSession, t});
    return {messaging, session};
}

describe("useSessionMessaging.applyExchangeOutcome", () => {
    it("advances the cycle step, propagates the verdict, and fires the step-advance toast", () => {
        const {result} = renderHook(useHarness);
        act(() => result.current.messaging.applyExchangeOutcome(exchangeResult()));
        expect(result.current.session?.cycle_step).toBe(2);
        expect(result.current.messaging.stepEvaluation).toEqual({
            applied: true,
            from_step: 1,
        });
        expect(notify.info).toHaveBeenCalled();
    });

    it("fires the cycle_advanced toast when the auto-loop looped", () => {
        const {result} = renderHook(useHarness);
        act(() =>
            result.current.messaging.applyExchangeOutcome(
                exchangeResult({
                    topic_transition: {
                        looped: true,
                        new_cycle_count: 2,
                        summary: "Done with greetings.",
                        next_topic: "Numbers",
                    },
                }),
            ),
        );
        expect(notify.success).toHaveBeenCalledWith("Cycle 2 started");
    });

    it("does NOT fire the step-advance toast when the verdict was not applied", () => {
        const {result} = renderHook(useHarness);
        act(() =>
            result.current.messaging.applyExchangeOutcome(
                exchangeResult({
                    session: {...SESSION, cycle_step: 1},
                    step_evaluation: {applied: false, from_step: 1},
                }),
            ),
        );
        expect(notify.info).not.toHaveBeenCalled();
    });

    it("does NOT fire the step-advance toast when the step was repeated (from_step == cycle_step)", () => {
        const {result} = renderHook(useHarness);
        act(() =>
            result.current.messaging.applyExchangeOutcome(
                exchangeResult({
                    session: {...SESSION, cycle_step: 1},
                    step_evaluation: {applied: true, from_step: 1},
                }),
            ),
        );
        expect(notify.info).not.toHaveBeenCalled();
    });

    it("maps the no_api_key classification to the friendly message", () => {
        const {result} = renderHook(useHarness);
        act(() =>
            result.current.messaging.applyExchangeOutcome(
                exchangeResult({
                    step_evaluation: null,
                    ai_error: "raw provider detail",
                    ai_error_code: "no_api_key",
                }),
            ),
        );
        expect(notify.error).toHaveBeenCalledWith(
            expect.stringContaining("No AI key set."),
        );
    });
});
