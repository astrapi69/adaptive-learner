/**
 * useKeyboardShortcuts tests (#585).
 *
 * Pins the matching contract (key + modifiers), the input auto-disable,
 * the allowInInput opt-in, the enabled switch, and the pure
 * conflict detector.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import {
    detectShortcutConflicts,
    useKeyboardShortcuts,
    type ShortcutDefinition,
} from "./useKeyboardShortcuts";

function Harness({
    shortcuts,
    enabled = true,
}: {
    shortcuts: ShortcutDefinition[];
    enabled?: boolean;
}) {
    useKeyboardShortcuts(shortcuts, {enabled});
    return <input data-testid="inp" />;
}

describe("detectShortcutConflicts", () => {
    it("flags same key+modifiers in the same context", () => {
        const conflicts = detectShortcutConflicts([
            {id: "a", key: "d", modifiers: {alt: true}, context: "nav", description: "", action: () => {}},
            {id: "b", key: "D", modifiers: {alt: true}, context: "nav", description: "", action: () => {}},
            {id: "c", key: "d", modifiers: {alt: true}, context: "lesson", description: "", action: () => {}},
        ]);
        const sigs = Object.values(conflicts);
        expect(sigs).toEqual([["a", "b"]]);
    });
});

describe("useKeyboardShortcuts", () => {
    it("fires the matching shortcut and respects modifiers", () => {
        const action = vi.fn();
        render(
            <Harness
                shortcuts={[
                    {id: "alt-d", key: "d", modifiers: {alt: true}, description: "", action},
                ]}
            />,
        );
        // wrong modifiers — no fire
        fireEvent.keyDown(document, {key: "d"});
        expect(action).not.toHaveBeenCalled();
        // correct
        fireEvent.keyDown(document, {key: "d", altKey: true});
        expect(action).toHaveBeenCalledOnce();
    });

    it("matches ctrlOrMeta on either ctrl or meta", () => {
        const action = vi.fn();
        render(
            <Harness
                shortcuts={[
                    {id: "mod-comma", key: ",", modifiers: {ctrlOrMeta: true}, description: "", action},
                ]}
            />,
        );
        fireEvent.keyDown(document, {key: ",", metaKey: true});
        fireEvent.keyDown(document, {key: ",", ctrlKey: true});
        expect(action).toHaveBeenCalledTimes(2);
    });

    it("skips shortcuts while an input is focused unless allowInInput", () => {
        const guarded = vi.fn();
        const allowed = vi.fn();
        render(
            <Harness
                shortcuts={[
                    {id: "g", key: "?", description: "", action: guarded},
                    {id: "a", key: "Escape", allowInInput: true, description: "", action: allowed},
                ]}
            />,
        );
        const input = screen.getByTestId("inp");
        input.focus();
        fireEvent.keyDown(input, {key: "?"});
        fireEvent.keyDown(input, {key: "Escape"});
        expect(guarded).not.toHaveBeenCalled();
        expect(allowed).toHaveBeenCalledOnce();
    });

    it("does nothing when disabled", () => {
        const action = vi.fn();
        render(
            <Harness
                enabled={false}
                shortcuts={[{id: "x", key: "x", description: "", action}]}
            />,
        );
        fireEvent.keyDown(document, {key: "x"});
        expect(action).not.toHaveBeenCalled();
    });
});
