/**
 * Tests for the "Weitermachen" row-dismissal store (#3023).
 *
 * Pins the two properties the feature stands on:
 * - a dismissed row stays hidden across reloads (persisted), and
 * - it comes BACK as soon as the set is touched again (self-healing),
 *   because the dismissal is recorded against the row's ``updated_at``.
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    dismissContinueRow,
    isContinueRowDismissed,
    readContinueDismissals,
    restoreContinueRow,
} from "./continue-dismissed-store";

function fakeStorage(): Storage {
    const map = new Map<string, string>();
    return {
        get length() {
            return map.size;
        },
        clear: () => map.clear(),
        getItem: (key: string) => map.get(key) ?? null,
        key: (index: number) => [...map.keys()][index] ?? null,
        removeItem: (key: string) => void map.delete(key),
        setItem: (key: string, value: string) => void map.set(key, value),
    } as Storage;
}

let storage: Storage;

beforeEach(() => {
    storage = fakeStorage();
});

describe("continue-dismissed-store", () => {
    it("hides a row that was dismissed at its current state", () => {
        dismissContinueRow("owner/repo", "fr-a1", "2026-06-03T10:00:00Z", storage);
        expect(
            isContinueRowDismissed("owner/repo", "fr-a1", "2026-06-03T10:00:00Z", storage),
        ).toBe(true);
    });

    it("shows the row again after newer activity on the set", () => {
        dismissContinueRow("owner/repo", "fr-a1", "2026-06-03T10:00:00Z", storage);
        expect(
            isContinueRowDismissed("owner/repo", "fr-a1", "2026-06-04T08:00:00Z", storage),
        ).toBe(false);
    });

    it("keeps an untouched row visible", () => {
        expect(
            isContinueRowDismissed("owner/repo", "other", "2026-06-03T10:00:00Z", storage),
        ).toBe(false);
    });

    it("scopes the dismissal to source + set id", () => {
        dismissContinueRow("owner/repo", "fr-a1", "2026-06-03T10:00:00Z", storage);
        expect(
            isContinueRowDismissed("other/repo", "fr-a1", "2026-06-03T10:00:00Z", storage),
        ).toBe(false);
    });

    it("restores a dismissed row (undo path)", () => {
        dismissContinueRow("owner/repo", "fr-a1", "2026-06-03T10:00:00Z", storage);
        restoreContinueRow("owner/repo", "fr-a1", storage);
        expect(
            isContinueRowDismissed("owner/repo", "fr-a1", "2026-06-03T10:00:00Z", storage),
        ).toBe(false);
    });

    it("keeps the newest dismissal when the same set is dismissed twice", () => {
        dismissContinueRow("owner/repo", "fr-a1", "2026-06-03T10:00:00Z", storage);
        dismissContinueRow("owner/repo", "fr-a1", "2026-06-05T10:00:00Z", storage);
        expect(
            isContinueRowDismissed("owner/repo", "fr-a1", "2026-06-04T10:00:00Z", storage),
        ).toBe(true);
    });

    it("tolerates corrupt storage by reading an empty map", () => {
        storage.setItem("adaptive-learner.continue-dismissed", "{not json");
        expect(readContinueDismissals(storage)).toEqual({});
        expect(
            isContinueRowDismissed("owner/repo", "fr-a1", "2026-06-03T10:00:00Z", storage),
        ).toBe(false);
    });

    it("drops corrupt entries but keeps the valid ones", () => {
        storage.setItem(
            "adaptive-learner.continue-dismissed",
            JSON.stringify({"owner/repo::fr-a1": "2026-06-03T10:00:00Z", "owner/repo::bad": 42}),
        );
        expect(readContinueDismissals(storage)).toEqual({
            "owner/repo::fr-a1": "2026-06-03T10:00:00Z",
        });
    });
});
