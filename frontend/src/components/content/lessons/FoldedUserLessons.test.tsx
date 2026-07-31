import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import type {FoldedUserLesson} from "../../../lib/content/browse/content-tree";
import type {ContentSetEntry} from "../../../storage/types";
import FoldedUserLessons from "./FoldedUserLessons";

function setEntry(over: Partial<ContentSetEntry>): ContentSetEntry {
    return {
        source: "user-generated",
        branch: "main",
        id: "mine",
        title: "Mein Set",
        title_native: null,
        language: "es",
        target_language: "es",
        source_language: "de",
        level: "A1",
        domain: "analysis",
        version: "1.0.0",
        lesson_count: 1,
        description: null,
        tags: [],
        cover_image: null,
        cached_version: "1.0.0",
        update_available: false,
        ...over,
    };
}

const lessons: FoldedUserLesson[] = [
    {
        lessonId: "l1",
        filename: "l1.json",
        title: "Eigene Lektion",
        setSource: "user-generated",
        setId: "mine",
        origin: "own",
    },
    {
        lessonId: "l2",
        filename: "l2.json",
        title: "Bearbeitung",
        setSource: "user-generated",
        setId: "mine",
        origin: "edit",
    },
];

function renderFolded(extra: Partial<React.ComponentProps<typeof FoldedUserLessons>> = {}) {
    const onPlayLesson = vi.fn();
    const onEdit = vi.fn();
    render(
        <FoldedUserLessons
            lessons={lessons}
            setsByKey={{"user-generated#mine": setEntry({})}}
            communitySharingEnabled
            onPlayLesson={onPlayLesson}
            onEdit={onEdit}
            onExportJson={vi.fn()}
            onExportSet={vi.fn()}
            onShare={vi.fn()}
            onDelete={vi.fn()}
            {...extra}
        />,
    );
    return {onPlayLesson, onEdit};
}

describe("FoldedUserLessons", () => {
    it("renders nothing when there are no folded lessons", () => {
        const {container} = render(
            <FoldedUserLessons
                lessons={[]}
                setsByKey={{}}
                communitySharingEnabled={false}
                onPlayLesson={vi.fn()}
                onEdit={vi.fn()}
                onExportJson={vi.fn()}
                onExportSet={vi.fn()}
                onShare={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("renders own/edit badges per lesson", () => {
        renderFolded();
        expect(screen.getByTestId("folded-lesson-l1-badge")).toHaveTextContent("Your lesson");
        expect(screen.getByTestId("folded-lesson-l2-badge")).toHaveTextContent("Your edit");
    });

    it("plays the specific lesson on its Play action", () => {
        const {onPlayLesson} = renderFolded();
        fireEvent.click(screen.getByTestId("folded-lesson-l2-play"));
        expect(onPlayLesson).toHaveBeenCalledWith(lessons[1]);
    });

    it("offers the shared set actions incl. Edit for every own lesson (#1740)", () => {
        renderFolded();
        expect(screen.getByTestId("folded-lesson-l1-edit")).toBeInTheDocument();
        expect(screen.getByTestId("folded-lesson-l1-delete")).toBeInTheDocument();
        expect(screen.getByTestId("folded-lesson-l1-share")).toBeInTheDocument();
    });

    it("shows Edit for a created/imported-origin set too (#1740)", () => {
        renderFolded({
            setsByKey: {"user-generated#mine": setEntry({domain: "imported"})},
        });
        expect(screen.getByTestId("folded-lesson-l1-edit")).toBeInTheDocument();
    });

    it("edits the specific folded lesson, not the set's first (#2210)", () => {
        const {onEdit} = renderFolded();
        fireEvent.click(screen.getByTestId("folded-lesson-l2-edit"));
        expect(onEdit).toHaveBeenCalledWith(
            expect.objectContaining({id: "mine"}),
            "l2.json",
        );
    });

    it("skips a lesson whose owning set is missing from the lookup", () => {
        renderFolded({setsByKey: {}});
        expect(screen.queryByTestId("folded-lesson-l1")).not.toBeInTheDocument();
    });
});
