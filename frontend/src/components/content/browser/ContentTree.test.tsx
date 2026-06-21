/**
 * Render tests for ContentTree folding + counts (EXP-026 / UGC-04+05).
 * Uses the useI18n fallback strings (no provider needed).
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import {buildContentTree, type UserFoldInput} from "../../../lib/content/browse/content-tree";
import type {ContentSetEntry} from "../../../storage/types";
import ContentTree, {type FoldedLessonActions} from "./ContentTree";

function entry(over: Partial<ContentSetEntry>): ContentSetEntry {
    return {
        source: "astrapi69/adaptive-learner-content",
        branch: "main",
        id: "es-a1-from-de",
        title: "Spanisch A1",
        title_native: null,
        language: "es",
        target_language: "es",
        source_language: "de",
        level: "A1",
        domain: "language",
        version: "1.0.0",
        lesson_count: 3,
        description: null,
        tags: [],
        cover_image: null,
        cached_version: "1.0.0",
        update_available: false,
        ...over,
    };
}

const userSet = entry({source: "user-generated", id: "mine", title: "Mein Set", domain: "analysis"});

const fold: UserFoldInput = {
    set: {...userSet, domain: "language"},
    lessons: [{id: "l1", filename: "l1.json", title: "Meine Lektion"}],
};

const foldedActions: FoldedLessonActions = {
    setsByKey: {"user-generated#mine": userSet},
    communitySharingEnabled: true,
    onPlayLesson: vi.fn(),
    onEdit: vi.fn(),
    onExportJson: vi.fn(),
    onExportSet: vi.fn(),
    onShare: vi.fn(),
    onDelete: vi.fn(),
};

function renderTree(folded?: FoldedLessonActions) {
    const tree = buildContentTree([entry({})], ["de"], folded ? [fold] : []);
    render(
        <ContentTree
            tree={tree}
            lang="de"
            collapsed={{}}
            toggleNode={vi.fn()}
            otherExpanded={false}
            setOtherExpanded={vi.fn()}
            bookRecs={{}}
            setRow={{
                perSetState: {},
                online: true,
                repoMeta: {},
                recommendedSources: new Set(),
                onOpen: vi.fn(),
                onDownload: vi.fn(),
            }}
            folded={folded}
        />,
    );
}

describe("ContentTree folding + counts", () => {
    it("renders the folded user lesson block under the level", () => {
        renderTree(foldedActions);
        expect(screen.getByTestId("content-folded-lessons")).toBeInTheDocument();
        expect(screen.getByTestId("folded-lesson-l1")).toHaveTextContent("Meine Lektion");
        expect(screen.getByTestId("folded-lesson-l1-badge")).toHaveTextContent("Your lesson");
    });

    it("shows the '+N own' count only when lessons are folded", () => {
        renderTree(foldedActions);
        expect(
            screen.getByTestId("content-level-de/es-A1-own-count"),
        ).toHaveTextContent("+1 own");
    });

    it("renders no folded block or own-count without folding", () => {
        renderTree();
        expect(screen.queryByTestId("content-folded-lessons")).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("content-level-de/es-A1-own-count"),
        ).not.toBeInTheDocument();
    });
});
