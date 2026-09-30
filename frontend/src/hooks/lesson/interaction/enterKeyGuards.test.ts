/**
 * #3357 - ``submitOnEnter`` is the one place a control that submits on Enter
 * claims the keystroke, so the lesson Enter shortcut steps aside.
 */
import type {KeyboardEvent as ReactKeyboardEvent} from "react";
import {describe, expect, it, vi} from "vitest";

import {submitOnEnter} from "./enterKeyGuards";

function reactEnter(init: KeyboardEventInit): {
    event: ReactKeyboardEvent<HTMLInputElement>;
    preventDefault: ReturnType<typeof vi.fn>;
} {
    const preventDefault = vi.fn();
    const event = {
        key: init.key,
        nativeEvent: new KeyboardEvent("keydown", init),
        preventDefault,
    } as unknown as ReactKeyboardEvent<HTMLInputElement>;
    return {event, preventDefault};
}

describe("submitOnEnter (#3357)", () => {
    it.each([
        ["plain Enter, answer ready", {key: "Enter"}, true, true, true],
        ["plain Enter, answer incomplete", {key: "Enter"}, false, true, false],
        ["Enter confirming an IME composition", {key: "Enter", isComposing: true}, true, false, false],
        ["Shift+Enter", {key: "Enter", shiftKey: true}, true, false, false],
        ["another key", {key: "a"}, true, false, false],
    ])("%s", (_label, init, canSubmit, expectClaimed, expectSubmitted) => {
        const submit = vi.fn();
        const {event, preventDefault} = reactEnter(init);
        const submitted = submitOnEnter(event, canSubmit, submit);
        expect(preventDefault).toHaveBeenCalledTimes(expectClaimed ? 1 : 0);
        expect(submit).toHaveBeenCalledTimes(expectSubmitted ? 1 : 0);
        expect(submitted).toBe(expectSubmitted);
    });
});
