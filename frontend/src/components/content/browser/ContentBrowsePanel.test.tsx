/**
 * ContentBrowsePanel (#1793).
 *
 * Pins the extracted browse section: the empty vs filter-empty
 * states (#1386 one-tap reset), the #1351 select-all wiring, and
 * the #1240 list ⇄ tree dispatch. The heavy children (tree, list
 * view) are stubbed — their own contracts live in their suites.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ContentBrowsePanel from "./ContentBrowsePanel";
import type ContentTree from "./ContentTree";
import type {useSetSelection} from "../../../hooks/content/useSetSelection";
import type {ContentSetEntry} from "../../../storage/types";
import type {ComponentProps} from "react";

vi.mock("../../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback: string) => fallback,
        lang: "en",
    }),
}));

vi.mock("./ContentTree", () => ({
    default: () => <div data-testid="tree-stub" />,
}));

vi.mock("./ContentSetListView", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("./ContentSetListView")>();
    return {
        setSelectionKey: actual.setSelectionKey,
        default: () => <div data-testid="list-stub" />,
    };
});

vi.mock("./BulkActionBar", () => ({
    default: ({count}: {count: number}) => (
        <div data-testid="bulk-bar-stub" data-count={count} />
    ),
}));

function entry(id: string): ContentSetEntry {
    return {id, source: "astrapi69/adaptive-learner-content"} as ContentSetEntry;
}

function selectionStub(
    overrides: Partial<ReturnType<typeof useSetSelection>> = {},
): ReturnType<typeof useSetSelection> {
    return {
        selected: new Set<string>(),
        count: 0,
        isSelected: () => false,
        masterState: () => false,
        selectAll: vi.fn(),
        toggle: vi.fn(),
        clear: vi.fn(),
        ...overrides,
    } as unknown as ReturnType<typeof useSetSelection>;
}

function renderPanel(
    props: Partial<ComponentProps<typeof ContentBrowsePanel>> = {},
) {
    const defaults: ComponentProps<typeof ContentBrowsePanel> = {
        hasDownloadedSets: true,
        visibleSets: [entry("a"), entry("b")],
        viewMode: "grid",
        onViewModeChange: vi.fn(),
        onResetFilters: vi.fn(),
        selection: selectionStub(),
        onBulkSetStatus: vi.fn(),
        onBulkDelete: vi.fn(),
        onSetStatus: vi.fn(),
        onDeleteSet: vi.fn(),
        treeProps: {} as unknown as ComponentProps<typeof ContentTree>,
    };
    const merged = {...defaults, ...props};
    return {...render(<ContentBrowsePanel {...merged} />), props: merged};
}

describe("ContentBrowsePanel", () => {
    it("shows the empty state when nothing is downloaded", () => {
        renderPanel({hasDownloadedSets: false, visibleSets: []});
        expect(screen.getByTestId("content-empty")).toBeInTheDocument();
        expect(screen.queryByTestId("content-select-all-row")).toBeNull();
    });

    it("shows the filter-empty state with a working reset (#1386)", () => {
        const {props} = renderPanel({visibleSets: []});
        expect(screen.getByTestId("content-filter-empty")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("content-filter-reset"));
        expect(props.onResetFilters).toHaveBeenCalledTimes(1);
    });

    it("renders the tree in grid mode and the list in list mode (#1240)", () => {
        renderPanel({viewMode: "grid"});
        expect(screen.getByTestId("tree-stub")).toBeInTheDocument();
        expect(screen.queryByTestId("list-stub")).toBeNull();

        renderPanel({viewMode: "list"});
        expect(screen.getByTestId("list-stub")).toBeInTheDocument();
    });

    it("select-all covers the visible sets and the bulk bar sees the count (#1351)", () => {
        const selection = selectionStub({count: 2});
        renderPanel({selection});
        fireEvent.click(screen.getByTestId("content-select-all"));
        expect(selection.selectAll).toHaveBeenCalledWith([
            "astrapi69/adaptive-learner-content#a",
            "astrapi69/adaptive-learner-content#b",
        ]);
        expect(screen.getByTestId("bulk-bar-stub")).toHaveAttribute(
            "data-count",
            "2",
        );
    });
});
