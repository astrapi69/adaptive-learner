/**
 * errorReplayScopePref (#1874) — the "only errors / whole set" replay
 * preference, localStorage-backed, default errors-only.
 */

import {afterEach, describe, expect, it, vi} from "vitest";

import {
    DEFAULT_ERROR_REPLAY_ERRORS_ONLY,
    ERROR_REPLAY_SCOPE_CHANGE_EVENT,
    readErrorReplayErrorsOnly,
    setErrorReplayErrorsOnly,
} from "./errorReplayScopePref";

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("errorReplayScopePref", () => {
    it("defaults to errors-only when unset", () => {
        expect(readErrorReplayErrorsOnly()).toBe(true);
        expect(DEFAULT_ERROR_REPLAY_ERRORS_ONLY).toBe(true);
    });

    it("round-trips true/false", () => {
        setErrorReplayErrorsOnly(false);
        expect(readErrorReplayErrorsOnly()).toBe(false);
        setErrorReplayErrorsOnly(true);
        expect(readErrorReplayErrorsOnly()).toBe(true);
    });

    it("dispatches the change event on write", () => {
        const listener = vi.fn();
        window.addEventListener(ERROR_REPLAY_SCOPE_CHANGE_EVENT, listener);
        setErrorReplayErrorsOnly(false);
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(ERROR_REPLAY_SCOPE_CHANGE_EVENT, listener);
    });

    it("falls back to the default on an unreadable value", () => {
        localStorage.setItem(
            "adaptive-learner.lesson.error_replay_errors_only",
            "garbage",
        );
        expect(readErrorReplayErrorsOnly()).toBe(true);
    });
});
