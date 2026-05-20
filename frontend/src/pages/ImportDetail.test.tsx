/**
 * Import detail page tests (Phase 12E).
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";

import ImportDetail from "./ImportDetail";
import {I18nProvider} from "../hooks/useI18n";
import {_resetDbForTests} from "../storage/db";
import {dexieStorage} from "../storage/dexie-storage";
import {_resetStorageCacheForTests} from "../storage";

vi.mock("../storage/ai-providers", () => ({
    aiComplete: vi.fn(),
    resolveModel: vi.fn(() => "test-model"),
}));

vi.mock("../utils/notify", () => ({
    notify: {
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

beforeEach(async () => {
    await _resetDbForTests();
    _resetStorageCacheForTests();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.storage_mode", "dexie");
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

afterEach(() => {
    vi.restoreAllMocks();
});

async function setup(analyzed = false) {
    const user = await dexieStorage.users.create({name: "A"});
    localStorage.setItem("adaptive-learner.user_id", user.id);
    const conv = await dexieStorage.imports.create(user.id, {
        source: "manual",
        title: "Test conversation",
        messages: [
            {role: "user", content: "Question one"},
            {role: "assistant", content: "Answer one"},
        ],
    });
    if (analyzed) {
        await dexieStorage.imports.saveAnalysis(conv.id, {
            analysis_result: {
                topic: "Test Topic",
                user_level: "beginner",
                summary: "A short summary.",
                strengths: ["Clear question"],
                weaknesses: ["Lacks detail"],
                recommended_method: "inductive",
                recommended_focus: "Practice more examples.",
                suggested_curriculum: [
                    {title: "Lesson 1", description: "Intro", priority: 1},
                ],
            },
        });
    }
    return conv;
}

function renderDetail(conversationId: string) {
    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={[`/import/${conversationId}`]}>
                <Routes>
                    <Route
                        path="/import/:conversationId"
                        element={<ImportDetail />}
                    />
                </Routes>
            </MemoryRouter>
        </I18nProvider>,
    );
}

describe("ImportDetail page", () => {
    it("renders the conversation transcript", async () => {
        const conv = await setup();
        renderDetail(conv.id);
        await waitFor(() => {
            expect(screen.getByTestId("conversation-transcript")).toBeTruthy();
        });
        expect(screen.getByTestId("msg-0").textContent).toContain(
            "Question one",
        );
        expect(screen.getByTestId("msg-1").textContent).toContain(
            "Answer one",
        );
    });

    it("renders the analyze button when no analysis yet", async () => {
        const conv = await setup(false);
        renderDetail(conv.id);
        await waitFor(() => {
            expect(screen.getByTestId("analyze-button")).toBeTruthy();
        });
        // Analysis results section absent.
        expect(screen.queryByTestId("analysis-results")).toBeNull();
    });

    it("renders analysis results when conversation is analyzed", async () => {
        const conv = await setup(true);
        renderDetail(conv.id);
        await waitFor(() => {
            expect(screen.getByTestId("analysis-results")).toBeTruthy();
        });
        expect(screen.getByText("Test Topic")).toBeTruthy();
        expect(screen.getByText("Clear question")).toBeTruthy();
        expect(screen.getByText("Lacks detail")).toBeTruthy();
        expect(screen.getByTestId("create-curriculum-button")).toBeTruthy();
        expect(screen.getByTestId("start-session-button")).toBeTruthy();
    });

    it("shows error state for unknown conversation id", async () => {
        renderDetail("bogus-id");
        await waitFor(() => {
            expect(screen.getByTestId("import-detail-error")).toBeTruthy();
        });
    });

    it("shows fallback notice when analysis used fallback", async () => {
        const user = await dexieStorage.users.create({name: "A"});
        localStorage.setItem("adaptive-learner.user_id", user.id);
        const conv = await dexieStorage.imports.create(user.id, {
            source: "manual",
            title: "Fallback",
            messages: [{role: "user", content: "X"}],
        });
        await dexieStorage.imports.saveAnalysis(conv.id, {
            analysis_result: {
                topic: "Fallback",
                summary: "Could not parse.",
                fallback_used: true,
            },
        });
        renderDetail(conv.id);
        await waitFor(() => {
            expect(
                screen.getByTestId("analysis-fallback-notice"),
            ).toBeTruthy();
        });
    });
});
