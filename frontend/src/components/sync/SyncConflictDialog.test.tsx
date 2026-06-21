/**
 * SyncConflictDialog tests (Phase 13D + 13E).
 *
 * The dialog is a pure presentational component over the
 * resolution state machine. We cover:
 *   - Render with conflicts and the three radio choices.
 *   - "Apply" returns the right resolution objects.
 *   - "Cancel" maps every conflict to "local".
 *   - parseMergeResponse contract (Smart Merge JSON path).
 */

import "fake-indexeddb/auto";

import {beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";

import SyncConflictDialog, {parseMergeResponse} from "./SyncConflictDialog";
import {I18nProvider} from "../../hooks/ui/useI18n";
import {ApiError} from "../../api/client";
import type {ConflictBundle, ConflictResolution} from "../../storage/sync/sync-engine";

vi.mock("../../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

vi.mock("../../storage/ai/ai-providers", () => ({
    aiComplete: vi.fn(),
    resolveModel: vi.fn(() => "test-model"),
}));

beforeEach(() => {
    localStorage.clear();
});

function makeConflict(table: string, id: string): ConflictBundle {
    return {
        table,
        id,
        local: {id, name: "Local name", language: "en"},
        remote: {id, name: "Remote name", language: "de"},
    };
}

function renderDialog(
    conflicts: ConflictBundle[],
    onResolve: (decisions: ConflictResolution[]) => void = () => undefined,
    onCancel: () => void = () => undefined,
) {
    return render(
        <I18nProvider>
            <SyncConflictDialog
                conflicts={conflicts}
                onResolve={onResolve}
                onCancel={onCancel}
            />
        </I18nProvider>,
    );
}

describe("SyncConflictDialog rendering", () => {
    it("renders one row per conflict", () => {
        renderDialog([
            makeConflict("users", "u-1"),
            makeConflict("learning_projects", "p-1"),
        ]);
        expect(screen.getByTestId("sync-conflict-0")).toBeTruthy();
        expect(screen.getByTestId("sync-conflict-1")).toBeTruthy();
    });

    it("renders the three radio choices per row", () => {
        renderDialog([makeConflict("users", "u-1")]);
        expect(screen.getByTestId("sync-conflict-0-local")).toBeTruthy();
        expect(screen.getByTestId("sync-conflict-0-remote")).toBeTruthy();
        expect(screen.getByTestId("sync-conflict-0-merged")).toBeTruthy();
    });

    it("defaults the choice to 'remote'", () => {
        renderDialog([makeConflict("users", "u-1")]);
        const remote = screen.getByTestId(
            "sync-conflict-0-remote",
        ) as HTMLInputElement;
        expect(remote.checked).toBe(true);
    });

    it("hides Smart Merge button when no AI provider is configured", () => {
        renderDialog([makeConflict("users", "u-1")]);
        // The async availability probe defaults the button to
        // hidden until proven true; with no user_id in localStorage
        // it should never appear.
        expect(screen.queryByTestId("sync-conflict-0-smart")).toBeNull();
    });
});

describe("SyncConflictDialog actions", () => {
    it("apply emits one resolution per conflict with the chosen value", () => {
        const onResolve = vi.fn();
        renderDialog([makeConflict("users", "u-1")], onResolve);
        // Default is remote → apply
        fireEvent.click(screen.getByTestId("sync-conflict-apply"));
        expect(onResolve).toHaveBeenCalledTimes(1);
        const decisions = onResolve.mock.calls[0][0] as ConflictResolution[];
        expect(decisions.length).toBe(1);
        expect(decisions[0].chosen).toBe("remote");
        expect(decisions[0].id).toBe("u-1");
        expect(decisions[0].table).toBe("users");
    });

    it("flipping a row to 'local' carries through to the resolution", () => {
        const onResolve = vi.fn();
        renderDialog([makeConflict("users", "u-1")], onResolve);
        fireEvent.click(screen.getByTestId("sync-conflict-0-local"));
        fireEvent.click(screen.getByTestId("sync-conflict-apply"));
        const decisions = onResolve.mock.calls[0][0] as ConflictResolution[];
        expect(decisions[0].chosen).toBe("local");
    });

    it("manual merge: editing a field surfaces in the resolution", () => {
        const onResolve = vi.fn();
        renderDialog([makeConflict("users", "u-1")], onResolve);
        fireEvent.click(screen.getByTestId("sync-conflict-0-merged"));
        // Edit the name field
        const nameInput = screen.getByTestId(
            "merge-field-name",
        ) as HTMLInputElement;
        expect(nameInput).toBeTruthy();
        fireEvent.change(nameInput, {target: {value: "Hand-merged name"}});
        fireEvent.click(screen.getByTestId("sync-conflict-apply"));
        const decisions = onResolve.mock.calls[0][0] as ConflictResolution[];
        expect(decisions[0].chosen).toBe("merged");
        expect(decisions[0].merged_data?.name).toBe("Hand-merged name");
    });

    it("cancel callback fires when Cancel is clicked", () => {
        const onCancel = vi.fn();
        renderDialog([makeConflict("users", "u-1")], () => undefined, onCancel);
        fireEvent.click(screen.getByTestId("sync-conflict-cancel"));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    // Phase 39 C2 — WCAG SC 2.1.2 keyboard escape pin.
    it("Escape key fires onCancel", () => {
        const onCancel = vi.fn();
        renderDialog([makeConflict("users", "u-1")], () => undefined, onCancel);
        fireEvent.keyDown(window, {key: "Escape"});
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

describe("parseMergeResponse", () => {
    const conflict: ConflictBundle = {
        table: "users",
        id: "u-1",
        local: {id: "u-1", name: "A"},
        remote: {id: "u-1", name: "B"},
    };

    it("parses clean JSON", () => {
        const result = parseMergeResponse(
            JSON.stringify({id: "u-1", name: "Merged"}),
            conflict,
        );
        expect(result.name).toBe("Merged");
        expect(result.id).toBe("u-1");
    });

    it("strips ```json fences", () => {
        const result = parseMergeResponse(
            "```json\n" + JSON.stringify({name: "Merged"}) + "\n```",
            conflict,
        );
        expect(result.name).toBe("Merged");
    });

    it("force-preserves the original id even if the AI changes it", () => {
        const result = parseMergeResponse(
            JSON.stringify({id: "different-id", name: "X"}),
            conflict,
        );
        expect(result.id).toBe("u-1");
    });

    it("throws on empty input", () => {
        expect(() => parseMergeResponse("", conflict)).toThrow(ApiError);
        expect(() => parseMergeResponse(null, conflict)).toThrow(ApiError);
    });

    it("throws on non-JSON output", () => {
        expect(() => parseMergeResponse("not json", conflict)).toThrow(ApiError);
    });

    it("throws when output is an array, not an object", () => {
        expect(() => parseMergeResponse("[1,2,3]", conflict)).toThrow(ApiError);
    });

    it("extracts the first {...} block from surrounding prose", () => {
        const result = parseMergeResponse(
            'Sure! ' + JSON.stringify({name: "Merged"}) + " Let me know.",
            conflict,
        );
        expect(result.name).toBe("Merged");
    });

    it("handles the Haiku prose+fence+trailing-braces failure shape (regression)", () => {
        const raw =
            "Sure, here's the merged record:\n\n" +
            "```json\n" +
            JSON.stringify({id: "u-1", name: "Merged", language: "en"}) +
            "\n```\n\n" +
            "I prioritized the {recent} edit.";
        const result = parseMergeResponse(raw, conflict);
        expect(result.name).toBe("Merged");
        expect(result.id).toBe("u-1");
    });
});
