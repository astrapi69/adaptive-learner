/**
 * Tests for the Content / Set Browser page
 * (Phase 43 / EXP-002 / 2D — F-100 + F-101).
 *
 * Renders the page against a mocked storage namespace so
 * neither the API client nor the Dexie helper runs. Pins:
 *
 * - Loading state shows the loading testid first.
 * - Sets list renders one row per entry with the
 *   download action button.
 * - "Installed" label appears for already-cached sets.
 * - "Update available" label appears when cached < upstream.
 * - Clicking the download button calls the storage method
 *   with the right (source, set_id).
 * - Empty-state renders when ``listSets`` returns no rows.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it, vi, beforeEach} from "vitest";

const listSetsMock = vi.fn();
const downloadSetMock = vi.fn();

vi.mock("../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            listSets: listSetsMock,
            downloadSet: downloadSetMock,
            listLessons: vi.fn(),
            getLesson: vi.fn(),
        },
    }),
}));

vi.mock("../utils/notify", () => ({
    notify: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

import ContentPage from "./Content";

const SAMPLE_ENTRY = {
    source: "astrapi69/adaptive-learner-content",
    branch: "main",
    id: "language-fr-a1",
    title: "French A1",
    language: "fr",
    level: "A1",
    domain: "language",
    version: "1.0.0",
    lesson_count: 12,
    description: "Beginner French lessons.",
    tags: ["beginner"],
    cover_image: null,
    cached_version: null,
    update_available: false,
};

beforeEach(() => {
    listSetsMock.mockReset();
    downloadSetMock.mockReset();
});

function renderPage() {
    return render(
        <MemoryRouter>
            <ContentPage />
        </MemoryRouter>,
    );
}

describe("ContentPage", () => {
    it("shows the loading state before the list resolves", () => {
        listSetsMock.mockImplementation(() => new Promise(() => {}));
        renderPage();
        expect(screen.getByTestId("content-loading")).toBeInTheDocument();
    });

    it("renders each set row after the list resolves", async () => {
        listSetsMock.mockResolvedValue({
            sets: [SAMPLE_ENTRY],
            sources: [{source: SAMPLE_ENTRY.source, branch: "main"}],
        });
        renderPage();
        await waitFor(() => {
            expect(screen.getByTestId("content-page")).toBeInTheDocument();
        });
        expect(
            screen.getByTestId("content-set-language-fr-a1"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("content-set-language-fr-a1-action"),
        ).toHaveTextContent(/Download/i);
    });

    it("shows 'Installed' for cached sets without an update", async () => {
        listSetsMock.mockResolvedValue({
            sets: [
                {
                    ...SAMPLE_ENTRY,
                    cached_version: "1.0.0",
                    update_available: false,
                },
            ],
            sources: [{source: SAMPLE_ENTRY.source, branch: "main"}],
        });
        renderPage();
        await waitFor(() => {
            expect(screen.getByTestId("content-page")).toBeInTheDocument();
        });
        const action = screen.getByTestId(
            "content-set-language-fr-a1-action",
        );
        expect(action).toHaveTextContent(/Installed/i);
        expect(action).toBeDisabled();
        expect(
            screen.getByTestId("content-set-language-fr-a1-cached"),
        ).toBeInTheDocument();
    });

    it("shows 'Update' for cached sets with a newer upstream", async () => {
        listSetsMock.mockResolvedValue({
            sets: [
                {
                    ...SAMPLE_ENTRY,
                    cached_version: "0.9.0",
                    update_available: true,
                },
            ],
            sources: [{source: SAMPLE_ENTRY.source, branch: "main"}],
        });
        renderPage();
        await waitFor(() => {
            expect(screen.getByTestId("content-page")).toBeInTheDocument();
        });
        const action = screen.getByTestId(
            "content-set-language-fr-a1-action",
        );
        expect(action).toHaveTextContent(/Update/i);
        expect(action).not.toBeDisabled();
        expect(
            screen.getByTestId("content-set-language-fr-a1-update"),
        ).toBeInTheDocument();
    });

    it("calls downloadSet on action button click", async () => {
        listSetsMock.mockResolvedValue({
            sets: [SAMPLE_ENTRY],
            sources: [{source: SAMPLE_ENTRY.source, branch: "main"}],
        });
        downloadSetMock.mockResolvedValue({
            ...SAMPLE_ENTRY,
            cached_version: "1.0.0",
            update_available: false,
        });
        renderPage();
        await waitFor(() => {
            expect(screen.getByTestId("content-page")).toBeInTheDocument();
        });
        await act(async () => {
            fireEvent.click(
                screen.getByTestId("content-set-language-fr-a1-action"),
            );
        });
        await waitFor(() => {
            expect(downloadSetMock).toHaveBeenCalledWith(
                "astrapi69/adaptive-learner-content",
                "language-fr-a1",
            );
        });
    });

    it("renders the empty state when no sets are available", async () => {
        listSetsMock.mockResolvedValue({sets: [], sources: []});
        renderPage();
        await waitFor(() => {
            expect(screen.getByTestId("content-page")).toBeInTheDocument();
        });
        expect(screen.getByTestId("content-empty")).toBeInTheDocument();
    });
});
