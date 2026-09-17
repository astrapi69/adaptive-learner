import {describe, expect, it, vi} from "vitest";

import {
    LESSON_PROGRESS_CHANGE_EVENT,
    notifyLessonProgressChanged,
    subscribeLessonProgressChanged,
} from "./progress-change-event";

describe("lesson progress change event (#3075)", () => {
    it("delivers a notification to every subscriber", () => {
        const first = vi.fn();
        const second = vi.fn();
        const offFirst = subscribeLessonProgressChanged(first);
        const offSecond = subscribeLessonProgressChanged(second);
        notifyLessonProgressChanged();
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        offFirst();
        offSecond();
    });

    it("stops delivering after unsubscribe", () => {
        const listener = vi.fn();
        const off = subscribeLessonProgressChanged(listener);
        off();
        notifyLessonProgressChanged();
        expect(listener).not.toHaveBeenCalled();
    });

    it("dispatches the documented window event name", () => {
        const listener = vi.fn();
        window.addEventListener(LESSON_PROGRESS_CHANGE_EVENT, listener);
        notifyLessonProgressChanged();
        window.removeEventListener(LESSON_PROGRESS_CHANGE_EVENT, listener);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("never throws when dispatching fails", () => {
        const spy = vi
            .spyOn(window, "dispatchEvent")
            .mockImplementation(() => {
                throw new Error("boom");
            });
        expect(() => notifyLessonProgressChanged()).not.toThrow();
        spy.mockRestore();
    });
});
