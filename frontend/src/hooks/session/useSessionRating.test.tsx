/**
 * useSessionRating (#1804).
 *
 * Hook-level pins for the end-of-session flow: rate-then-end +
 * navigate on success, error surface without navigation, and the
 * no-session guard.
 */

import {act, renderHook} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useSessionRating} from "./useSessionRating";
import {getStorage} from "../../storage";
import {notify} from "../../utils/notify";
import type {LearningSession} from "../../types";

vi.mock("../../storage", () => ({getStorage: vi.fn()}));
vi.mock("../../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn()},
}));

const t = (_key: string, fallback?: string) => fallback ?? _key;

const SESSION = {id: "s-1", status: "active"} as unknown as LearningSession;

const RATING = {
    understanding: 4,
    stress: 2,
    method_fit: 5,
    notes: "",
};

const rate = vi.fn();
const end = vi.fn();

beforeEach(() => {
    vi.mocked(notify.success).mockClear();
    vi.mocked(notify.error).mockClear();
    rate.mockReset().mockResolvedValue(undefined);
    end.mockReset().mockResolvedValue(undefined);
    vi.mocked(getStorage).mockReturnValue({
        session: {rate, end},
    } as unknown as ReturnType<typeof getStorage>);
});

function mount(session: LearningSession | null = SESSION) {
    const navigate = vi.fn();
    const hook = renderHook(() =>
        useSessionRating({
            session,
            navigate: navigate as unknown as Parameters<
                typeof useSessionRating
            >[0]["navigate"],
            t,
        }),
    );
    return {hook, navigate};
}

describe("useSessionRating", () => {
    it("rates, ends, closes the dialog, and navigates to the dashboard", async () => {
        const {hook, navigate} = mount();
        act(() => hook.result.current.setShowRating(true));
        await act(() => hook.result.current.handleRatingSubmit(RATING));
        expect(rate).toHaveBeenCalledWith("s-1", {
            understanding: 4,
            stress: 2,
            method_fit: 5,
            notes: null,
        });
        expect(end).toHaveBeenCalledWith("s-1");
        expect(notify.success).toHaveBeenCalledWith("Session ended.");
        expect(hook.result.current.showRating).toBe(false);
        expect(navigate).toHaveBeenCalledWith("/dashboard");
    });

    it("surfaces a failure as a toast and stays on the page", async () => {
        rate.mockRejectedValue(new Error("boom"));
        const {hook, navigate} = mount();
        await act(() => hook.result.current.handleRatingSubmit(RATING));
        expect(end).not.toHaveBeenCalled();
        expect(notify.error).toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(hook.result.current.submittingRating).toBe(false);
    });

    it("is a no-op without a session", async () => {
        const {hook, navigate} = mount(null);
        await act(() => hook.result.current.handleRatingSubmit(RATING));
        expect(rate).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });
});
