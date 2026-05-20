/**
 * Import page tests (Phase 12B + 12F).
 *
 * Mocks the storage layer + analysis engine so the suite never
 * hits a real backend. Renders the page under happy-dom + the
 * I18n provider with English fallbacks.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";

import Import from "./Import";
import {I18nProvider} from "../hooks/useI18n";
import {_resetDbForTests} from "../storage/db";
import {dexieStorage} from "../storage/dexie-storage";
import {_resetStorageCacheForTests} from "../storage";
import * as analysisModule from "../chat_import/analysis";
import * as storageModule from "../storage";
import * as aiProvidersModule from "../storage/ai-providers";

vi.mock("../storage/ai-providers", () => ({
    aiComplete: vi.fn().mockResolvedValue(
        JSON.stringify({topic: "Mocked", summary: "Mocked analysis."}),
    ),
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

// Use the Dexie backend explicitly so the test exercises the
// real persistence path.
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

async function makeUserWithKey() {
    const user = await dexieStorage.users.create({name: "Aster"});
    localStorage.setItem("adaptive-learner.user_id", user.id);
    // Inject a fake key directly via the Dexie row so the
    // analysis can be invoked end-to-end.
    const {getDb} = await import("../storage/db");
    const db = getDb();
    const settings = await db.userSettings.where("user_id").equals(user.id).first();
    if (settings) {
        await db.userSettings.put({...settings, api_key_anthropic: "test-key"});
    }
    return user;
}

function renderImport() {
    return render(
        <I18nProvider>
            <MemoryRouter>
                <Import />
            </MemoryRouter>
        </I18nProvider>,
    );
}

describe("Import page", () => {
    it("renders quick-paste, file-upload, and list sections", async () => {
        renderImport();
        await waitFor(() => {
            expect(screen.getByTestId("quick-paste")).toBeTruthy();
        });
        expect(screen.getByTestId("file-upload")).toBeTruthy();
        expect(screen.getByTestId("imports-list")).toBeTruthy();
    });

    it("disables analyze button until text is pasted", async () => {
        renderImport();
        await waitFor(() => {
            expect(screen.getByTestId("quick-analyze-button")).toBeTruthy();
        });
        const btn = screen.getByTestId(
            "quick-analyze-button",
        ) as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
    });

    it("shows detected format hint as user types", async () => {
        renderImport();
        await waitFor(() => {
            expect(screen.getByTestId("quick-paste-textarea")).toBeTruthy();
        });
        const textarea = screen.getByTestId("quick-paste-textarea");
        fireEvent.change(textarea, {
            target: {value: "User: hi\nAssistant: hello"},
        });
        await waitFor(() => {
            const hint = screen.getByTestId("quick-paste-format");
            expect(hint.textContent).toContain("markdown");
        });
    });

    it("imports a pasted conversation and persists it", async () => {
        await makeUserWithKey();
        renderImport();
        await waitFor(() => {
            expect(screen.getByTestId("quick-paste-textarea")).toBeTruthy();
        });
        const textarea = screen.getByTestId("quick-paste-textarea");
        fireEvent.change(textarea, {
            target: {value: "User: how do I learn?\nAssistant: practice."},
        });
        const btn = screen.getByTestId("quick-analyze-button");
        // Spy on analyzeConversation to skip the real network call.
        const spy = vi
            .spyOn(analysisModule, "analyzeConversation")
            .mockResolvedValue({topic: "Learning", summary: "mocked"});
        fireEvent.click(btn);
        await waitFor(
            () => {
                expect(spy).toHaveBeenCalled();
            },
            {timeout: 3000},
        );
    });

    it("shows empty state when no conversations imported", async () => {
        await makeUserWithKey();
        renderImport();
        await waitFor(() => {
            expect(screen.getByTestId("imports-empty")).toBeTruthy();
        });
    });

    /**
     * End-to-end regression for the post-v1.5.0 API-mode fix:
     * in API mode the page MUST dispatch the analysis through
     * the new server-side ``imports.analyze`` endpoint and MUST
     * NOT hit the browser-direct ``aiComplete`` path (the
     * cleartext key never leaves the backend).
     */
    it("API mode: routes analyze through backend, never calls browser-direct AI", async () => {
        await makeUserWithKey();
        const aiCompleteSpy = vi.spyOn(aiProvidersModule, "aiComplete");
        const analyzeSpy = vi.fn(async (conversationId: string) => ({
            id: conversationId,
            user_id: "u1",
            source: "manual" as const,
            title: "test",
            message_count: 2,
            imported_at: new Date().toISOString(),
            analyzed: true,
            messages: [],
            analysis_result: {
                topic: "Server-side topic",
                summary: "Computed on the backend.",
            },
        }));
        const fakeApiStorage = {
            ...dexieStorage,
            mode: "api" as const,
            imports: {
                ...dexieStorage.imports,
                analyze: analyzeSpy,
            },
        };
        vi.spyOn(storageModule, "getStorage").mockReturnValue(
            fakeApiStorage as unknown as ReturnType<typeof storageModule.getStorage>,
        );

        renderImport();
        await waitFor(() => {
            expect(screen.getByTestId("quick-paste-textarea")).toBeTruthy();
        });
        const textarea = screen.getByTestId("quick-paste-textarea");
        fireEvent.change(textarea, {
            target: {value: "User: hi\nAssistant: hello."},
        });
        fireEvent.click(screen.getByTestId("quick-analyze-button"));

        await waitFor(
            () => {
                expect(analyzeSpy).toHaveBeenCalled();
            },
            {timeout: 3000},
        );
        // Cleartext key MUST stay server-side: browser-direct AI
        // was never invoked.
        expect(aiCompleteSpy).not.toHaveBeenCalled();
    });

    /**
     * Companion regression: Dexie mode keeps the browser-direct
     * path. The new backend endpoint MUST NOT be called.
     */
    it("Dexie mode: keeps browser-direct path, never calls backend analyze", async () => {
        await makeUserWithKey();
        const dexieAnalyzeSpy = vi.spyOn(dexieStorage.imports, "analyze");
        const analysisSpy = vi
            .spyOn(analysisModule, "analyzeConversation")
            .mockResolvedValue({
                topic: "Learning",
                summary: "Computed in the browser.",
            });

        renderImport();
        await waitFor(() => {
            expect(screen.getByTestId("quick-paste-textarea")).toBeTruthy();
        });
        const textarea = screen.getByTestId("quick-paste-textarea");
        fireEvent.change(textarea, {
            target: {value: "User: hi\nAssistant: hello."},
        });
        fireEvent.click(screen.getByTestId("quick-analyze-button"));

        await waitFor(
            () => {
                expect(analysisSpy).toHaveBeenCalled();
            },
            {timeout: 3000},
        );
        // Backend /analyze MUST NOT be called in Dexie mode.
        expect(dexieAnalyzeSpy).not.toHaveBeenCalled();
    });
});
