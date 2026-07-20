/**
 * ErrorReplayScopeControl (#1874) — Settings control for the error-replay
 * scope ("only errors" vs "whole set").
 *
 * Pins: reflects the default (errors-only), switching writes the shared
 * ``errorReplayScopePref`` source, and the select is properly labelled.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";

import ErrorReplayScopeControl from "./ErrorReplayScopeControl";
import {readErrorReplayErrorsOnly} from "../../../../lib/lesson/errorReplayScopePref";

afterEach(() => {
    localStorage.clear();
});

describe("ErrorReplayScopeControl", () => {
    it("reflects the default (only errors) when nothing is stored", () => {
        render(<ErrorReplayScopeControl />);
        const select = screen.getByTestId(
            "settings-error-replay-scope",
        ) as HTMLSelectElement;
        expect(select.value).toBe("errors_only");
    });

    it("writes the shared pref when switched to whole set", () => {
        render(<ErrorReplayScopeControl />);
        act(() => {
            fireEvent.change(screen.getByTestId("settings-error-replay-scope"), {
                target: {value: "whole_set"},
            });
        });
        expect(readErrorReplayErrorsOnly()).toBe(false);
        expect(
            (screen.getByTestId("settings-error-replay-scope") as HTMLSelectElement)
                .value,
        ).toBe("whole_set");
    });

    it("has an accessible label associated with the select", () => {
        render(<ErrorReplayScopeControl />);
        // The <select> lives inside a <label> carrying the visible name.
        const select = screen.getByTestId("settings-error-replay-scope");
        expect(select.closest("label")).not.toBeNull();
        expect(select.closest("label")).toHaveTextContent(/Retry scope/i);
    });
});
