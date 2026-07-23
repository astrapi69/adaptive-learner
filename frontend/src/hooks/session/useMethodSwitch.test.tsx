/**
 * useMethodSwitch (#1804).
 *
 * Hook-level pins for the switch-recommendation flow: the fetch on
 * session-id resolution, the advisory silent-failure path, accept
 * (persist + session update + toast), and dismiss memory.
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useMethodSwitch} from "./useMethodSwitch";
import {getStorage} from "../../storage";
import {notify} from "../../utils/notify";
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

const switchRecommendation = vi.fn();
const acceptSwitch = vi.fn();

beforeEach(() => {
    vi.mocked(notify.success).mockClear();
    vi.mocked(notify.error).mockClear();
    switchRecommendation.mockReset();
    acceptSwitch.mockReset();
    switchRecommendation.mockResolvedValue({
        recommended: true,
        to_method: "inductive",
        reason: "Better fit.",
    });
    vi.mocked(getStorage).mockReturnValue({
        session: {switchRecommendation, acceptSwitch},
    } as unknown as ReturnType<typeof getStorage>);
});

function mount(session: LearningSession | null = SESSION) {
    const setSession = vi.fn();
    const hook = renderHook(() =>
        useMethodSwitch({session, setSession, t}),
    );
    return {hook, setSession};
}

describe("useMethodSwitch", () => {
    it("fetches the recommendation once the session id resolves", async () => {
        const {hook} = mount();
        await waitFor(() => {
            expect(hook.result.current.switchRec).toEqual(
                expect.objectContaining({recommended: true, to_method: "inductive"}),
            );
        });
        expect(switchRecommendation).toHaveBeenCalledWith("s-1");
        expect(switchRecommendation).toHaveBeenCalledTimes(1);
    });

    it("swallows a fetch failure into recommended:false (advisory)", async () => {
        switchRecommendation.mockRejectedValue(new Error("offline"));
        const {hook} = mount();
        await waitFor(() => {
            expect(hook.result.current.switchRec).toEqual({recommended: false});
        });
        expect(notify.error).not.toHaveBeenCalled();
    });

    it("accept persists the switch, updates the session, and toasts", async () => {
        const updated = {...SESSION, method: "inductive"};
        acceptSwitch.mockResolvedValue(updated);
        const {hook, setSession} = mount();
        await waitFor(() => {
            expect(hook.result.current.switchRec?.recommended).toBe(true);
        });
        await act(() => hook.result.current.handleAcceptSwitch());
        expect(acceptSwitch).toHaveBeenCalledWith("s-1", {
            to_method: "inductive",
            reason: "Better fit.",
        });
        expect(setSession).toHaveBeenCalledWith(updated);
        expect(hook.result.current.switchRec).toEqual({recommended: false});
        expect(notify.success).toHaveBeenCalledWith("Method switched.");
    });

    it("dismiss remembers the target method and hides the banner", async () => {
        const {hook} = mount();
        await waitFor(() => {
            expect(hook.result.current.switchRec?.recommended).toBe(true);
        });
        act(() => hook.result.current.handleDismissSwitch());
        expect(hook.result.current.switchDismissed).toBe("inductive");
        expect(hook.result.current.switchRec).toEqual({recommended: false});
    });
});
