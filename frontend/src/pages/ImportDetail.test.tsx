/**
 * Import detail page tests (Phase 12E).
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Route, Routes} from "react-router-dom";

import ImportDetail from "./ImportDetail";
import {I18nProvider} from "../hooks/useI18n";
import {_resetDbForTests} from "../storage/db";
import {dexieStorage} from "../storage/dexie-storage";
import {_resetStorageCacheForTests} from "../storage";
import {_resetApiKeyStatusCacheForTests} from "../hooks/useApiKeyStatus";
import {aiComplete} from "../storage/ai-providers";

vi.mock("../storage/ai-providers", () => ({
    aiComplete: vi.fn(),
    resolveModel: vi.fn(() => "test-model"),
}));

const mockAiComplete = vi.mocked(aiComplete);

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
    _resetApiKeyStatusCacheForTests();
    mockAiComplete.mockReset();
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

/**
 * Seed a user WITH an active-provider API key so the Analyze
 * button enables and ``runAnalysis`` proceeds past the key gate.
 * Returns the conversation (not yet analyzed).
 */
async function setupWithKey() {
    const user = await dexieStorage.users.create({name: "A"});
    localStorage.setItem("adaptive-learner.user_id", user.id);
    await dexieStorage.settings.setApiKey(user.id, {
        provider: "anthropic",
        key: "test-key",
    });
    return dexieStorage.imports.create(user.id, {
        source: "manual",
        title: "Test conversation",
        messages: [
            {role: "user", content: "Question one"},
            {role: "assistant", content: "Answer one"},
        ],
    });
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
    it("renders the conversation transcript (collapsed until toggled, #240)", async () => {
        const conv = await setup();
        renderDetail(conv.id);
        await waitFor(() => {
            expect(screen.getByTestId("conversation-transcript")).toBeTruthy();
        });
        // #240 — the raw transcript is collapsed by default; messages
        // appear only after the toggle is opened.
        expect(screen.queryByTestId("msg-0")).toBeNull();
        fireEvent.click(screen.getByTestId("transcript-toggle"));
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

    it("shows language pickers; source = app language, target auto-detected", async () => {
        // C2 — languages are set at import time. Source defaults to the
        // app language; target is auto-detected from the (French) content.
        const user = await dexieStorage.users.create({ name: "A" });
        localStorage.setItem("adaptive-learner.user_id", user.id);
        const conv = await dexieStorage.imports.create(user.id, {
            source: "manual",
            title: "Französisch lernen",
            messages: [
                {
                    role: "user",
                    content:
                        "Wie sage ich Hallo auf Französisch? Bonjour, merci, " +
                        "être und avoir im passé composé.",
                },
                { role: "assistant", content: "Bonjour heißt Hallo, merci danke." },
            ],
        });
        renderDetail(conv.id);
        await waitFor(() => {
            expect(screen.getByTestId("import-language-pickers")).toBeTruthy();
        });
        // shadcn/Radix Select: the chosen value renders as the
        // trigger's text (no native .value). Source shows a real
        // language (not the placeholder); target shows detected French.
        expect(
            screen.getByTestId("import-source-language"),
        ).not.toHaveTextContent(/Select a language/i);
        expect(
            screen.getByTestId("import-target-language"),
        ).toHaveTextContent(/French/);
    });

    it("persists a language change onto the import record", async () => {
        const user = await dexieStorage.users.create({ name: "A" });
        localStorage.setItem("adaptive-learner.user_id", user.id);
        const conv = await dexieStorage.imports.create(user.id, {
            source: "manual",
            title: "Chat",
            messages: [
                { role: "user", content: "Bonjour merci passé être avoir" },
                { role: "assistant", content: "oui" },
            ],
        });
        const ue = userEvent.setup();
        renderDetail(conv.id);
        const target = await screen.findByTestId("import-target-language");
        await ue.click(target);
        await ue.click(await screen.findByRole("option", {name: "Spanish (es)"}));
        await waitFor(async () => {
            const reread = await dexieStorage.imports.get(conv.id);
            expect(reread.target_language).toBe("es");
        });
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

    it("shows the loading indicator + spinner while analysis runs", async () => {
        const conv = await setupWithKey();
        // aiComplete never resolves within the test window — keeps
        // the loading state on screen for assertions.
        mockAiComplete.mockReturnValue(new Promise<string>(() => {}));
        renderDetail(conv.id);
        const button = await waitFor(() => {
            const b = screen.getByTestId(
                "analyze-button",
            ) as HTMLButtonElement;
            expect(b.disabled).toBe(false);
            return b;
        });
        fireEvent.click(button);
        await waitFor(() => {
            expect(screen.getByTestId("analysis-loading")).toBeTruthy();
        });
        expect(screen.getByTestId("analyze-spinner")).toBeTruthy();
        expect(screen.getByTestId("cancel-analysis-button")).toBeTruthy();
        // "1/3" is locale-independent (both EN "Step 1/3" and DE
        // "Schritt 1/3"); the I18nProvider default locale varies.
        expect(screen.getByTestId("analysis-phase").textContent).toContain(
            "1/3",
        );
        expect(
            (screen.getByTestId("analyze-button") as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it("cancel aborts the analysis and returns to the pre-analysis state", async () => {
        const conv = await setupWithKey();
        // Reject with an AbortError when the signal fires. Mirror real
        // fetch: if the signal is ALREADY aborted by the time the call
        // is made (the cancel click can land before runAnalysis reaches
        // aiComplete), reject immediately — an "abort" listener added
        // after the fact would never fire and the promise would hang.
        mockAiComplete.mockImplementation(
            (opts) =>
                new Promise<string>((_resolve, reject) => {
                    const fail = () =>
                        reject(new DOMException("aborted", "AbortError"));
                    if (opts.signal?.aborted) {
                        fail();
                        return;
                    }
                    opts.signal?.addEventListener("abort", fail);
                }),
        );
        renderDetail(conv.id);
        const button = await waitFor(() => {
            const b = screen.getByTestId(
                "analyze-button",
            ) as HTMLButtonElement;
            expect(b.disabled).toBe(false);
            return b;
        });
        fireEvent.click(button);
        const cancel = await waitFor(() =>
            screen.getByTestId("cancel-analysis-button"),
        );
        fireEvent.click(cancel);
        // Loading panel disappears, no results, no inline error,
        // button is enabled again. A generous timeout keeps this
        // deterministic under heavy parallel-suite CPU load (the
        // abort -> reject -> re-render chain is fast but can exceed
        // the 1s default when the machine is saturated).
        await waitFor(
            () => {
                expect(screen.queryByTestId("analysis-loading")).toBeNull();
            },
            {timeout: 5000},
        );
        expect(screen.queryByTestId("analysis-results")).toBeNull();
        expect(screen.queryByTestId("analysis-error-inline")).toBeNull();
        expect(
            (screen.getByTestId("analyze-button") as HTMLButtonElement)
                .disabled,
        ).toBe(false);
    });

    it("shows a friendly inline error when the analysis throws", async () => {
        const conv = await setupWithKey();
        mockAiComplete.mockResolvedValue(
            JSON.stringify({topic: "T", summary: "S"}),
        );
        // Force the persist step to throw so runAnalysis hits the
        // inline-error branch (provider parse failures collapse to a
        // fallback instead and are covered separately).
        const saveSpy = vi
            .spyOn(dexieStorage.imports, "saveAnalysis")
            .mockRejectedValue(new Error("disk full"));
        renderDetail(conv.id);
        const button = await waitFor(() => {
            const b = screen.getByTestId(
                "analyze-button",
            ) as HTMLButtonElement;
            expect(b.disabled).toBe(false);
            return b;
        });
        fireEvent.click(button);
        await waitFor(() => {
            expect(screen.getByTestId("analysis-error-inline")).toBeTruthy();
        });
        // Locale-agnostic: a non-empty friendly message is present
        // (exact wording depends on the I18nProvider default locale).
        expect(
            (screen.getByTestId("analysis-error-inline").textContent ?? "")
                .length,
        ).toBeGreaterThan(0);
        // Button re-enabled, loading panel gone.
        expect(screen.queryByTestId("analysis-loading")).toBeNull();
        expect(
            (screen.getByTestId("analyze-button") as HTMLButtonElement)
                .disabled,
        ).toBe(false);
        saveSpy.mockRestore();
    });
});
