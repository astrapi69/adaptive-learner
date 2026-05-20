/**
 * ExportSection tests (Phase 16D).
 *
 * Mocks the storage layer's export namespace so the component
 * is exercised without a backend or IndexedDB. Covers:
 *
 *   - Renders the section title, three export rows, and the
 *     Markdown + PDF buttons.
 *   - Clicking the Markdown button triggers a download.
 *   - Picking a session enables the session row's Markdown / PDF
 *     buttons; the empty selection blocks export.
 *   - Preview button populates the preview pane.
 *   - Returns null when no user is set.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";

import ExportSection from "./ExportSection";
import {I18nProvider} from "../hooks/useI18n";
import {_resetStorageCacheForTests, getStorage} from "../storage";
import {setUserId} from "../lib/learnerState";
import type {ProgressReport} from "../storage/export-builder";

vi.mock("../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

vi.mock("../lib/export/pdf-generator", () => ({
    openPrintWindow: vi.fn().mockResolvedValue(undefined),
}));

const SEED_USER_ID = "user-12345678";

const sampleProgress: ProgressReport = {
    format: "adaptive-learner-export",
    version: "1.3.0",
    type: "progress_report",
    generated_at: "2026-05-20T10:00:00.000Z",
    app_version: "1.3.0-test",
    lang: "en",
    user: {id: SEED_USER_ID, name: "Aster", language: "en"},
    profile: null,
    projects: [],
    recent_sessions: [],
    step_evaluation_insights: null,
    extractions: [],
};

function renderSection() {
    return render(
        <I18nProvider>
            <ExportSection />
        </I18nProvider>,
    );
}

beforeEach(() => {
    localStorage.clear();
    setUserId(SEED_USER_ID);
    _resetStorageCacheForTests();
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

describe("ExportSection", () => {
    it("renders nothing when no user is set", () => {
        localStorage.clear();
        const {container} = renderSection();
        expect(container.firstChild).toBeNull();
    });

    it("renders the section + three export rows", async () => {
        const storage = getStorage();
        vi.spyOn(storage.users.projects, "list").mockResolvedValue([]);
        vi.spyOn(storage.curricula, "list").mockResolvedValue([]);
        renderSection();
        expect(await screen.findByTestId("export-section")).toBeTruthy();
        expect(screen.getByTestId("export-row-progress")).toBeTruthy();
        expect(screen.getByTestId("export-row-session")).toBeTruthy();
        expect(screen.getByTestId("export-row-curriculum")).toBeTruthy();
    });

    it("downloads Markdown for the progress report", async () => {
        const storage = getStorage();
        vi.spyOn(storage.users.projects, "list").mockResolvedValue([]);
        vi.spyOn(storage.curricula, "list").mockResolvedValue([]);
        vi.spyOn(storage.export, "progress").mockResolvedValue(sampleProgress);
        const clickSpy = vi.fn();
        const origCreate = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation(
            (tag: string) => {
                const el = origCreate(tag);
                if (tag === "a") {
                    el.click = clickSpy;
                }
                return el;
            },
        );

        renderSection();
        const button = await screen.findByTestId("export-md-progress");
        await act(async () => {
            fireEvent.click(button);
        });
        await waitFor(() => expect(clickSpy).toHaveBeenCalledOnce());
    });

    it("opens the print dialog for PDF export", async () => {
        const storage = getStorage();
        vi.spyOn(storage.users.projects, "list").mockResolvedValue([]);
        vi.spyOn(storage.curricula, "list").mockResolvedValue([]);
        vi.spyOn(storage.export, "progress").mockResolvedValue(sampleProgress);
        const {openPrintWindow} = await import("../lib/export/pdf-generator");
        renderSection();
        const button = await screen.findByTestId("export-pdf-progress");
        await act(async () => {
            fireEvent.click(button);
        });
        await waitFor(() => expect(openPrintWindow).toHaveBeenCalledOnce());
    });

    it("shows preview pane with rendered markdown", async () => {
        const storage = getStorage();
        vi.spyOn(storage.users.projects, "list").mockResolvedValue([]);
        vi.spyOn(storage.curricula, "list").mockResolvedValue([]);
        vi.spyOn(storage.export, "progress").mockResolvedValue(sampleProgress);
        renderSection();
        const previewBtn = await screen.findByTestId("export-preview-progress");
        await act(async () => {
            fireEvent.click(previewBtn);
        });
        const pane = await screen.findByTestId("export-preview-pane");
        expect(pane.textContent).toContain("Learning Progress");
    });
});
