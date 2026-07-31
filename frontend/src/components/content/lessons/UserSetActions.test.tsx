/**
 * UserSetActions - the shared set-level action bar.
 *
 * #2210 — the set-level Edit button must NOT render when the set has more than
 * one lesson (there it would guess which lesson; the per-lesson Edit in
 * SetLessonList is the entry). It stays for a single-lesson set, where
 * "edit the set" is unambiguously "edit its one lesson".
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import UserSetActions from "./UserSetActions";
import type {ContentSetEntry} from "../../../storage/types";

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
    return {
        source: "user-generated",
        branch: "main",
        id: "mein-buch",
        title: "Mein Buch",
        language: "de",
        target_language: "de",
        source_language: "de",
        level: "A1",
        domain: "imported",
        version: "1.0.0",
        lesson_count: 1,
        description: null,
        tags: [],
        cover_image: null,
        cached_version: "1.0.0",
        update_available: false,
        ...over,
    } as ContentSetEntry;
}

function renderActions(over: Partial<React.ComponentProps<typeof UserSetActions>> = {}) {
    render(
        <UserSetActions
            entry={entry()}
            communitySharingEnabled={false}
            testIdPrefix="my-lesson-mein-buch"
            onPlay={vi.fn()}
            onEdit={vi.fn()}
            onExportJson={vi.fn()}
            onExportSet={vi.fn()}
            onShare={vi.fn()}
            onDelete={vi.fn()}
            {...over}
        />,
    );
}

describe("UserSetActions - set-level Edit visibility (#2210)", () => {
    it("shows Edit by default (single-lesson set: unambiguous)", () => {
        renderActions();
        expect(screen.getByTestId("my-lesson-mein-buch-edit")).toBeInTheDocument();
    });

    it("hides Edit when showEdit is false (multi-lesson set: would guess)", () => {
        renderActions({showEdit: false});
        expect(screen.queryByTestId("my-lesson-mein-buch-edit")).not.toBeInTheDocument();
        // The other actions stay.
        expect(screen.getByTestId("my-lesson-mein-buch-play")).toBeInTheDocument();
        expect(screen.getByTestId("my-lesson-mein-buch-delete")).toBeInTheDocument();
    });
});
