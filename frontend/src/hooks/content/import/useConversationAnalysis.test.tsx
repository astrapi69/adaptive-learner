/**
 * useConversationAnalysis (#1799).
 *
 * Hook-level pins for the analysis run (the phase-UI rendering is
 * covered by ImportDetail.analysis-loading.test.tsx): the pure
 * helpers, the guard paths (no user / no key), the happy path
 * (analyze -> saveAnalysis -> setDetail), and the inline error.
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {
    firstLang,
    pickModelOverride,
    resolveAnalysisLang,
    useConversationAnalysis,
} from "./useConversationAnalysis";
import {analyzeConversation} from "../../../chat_import/analysis";
import {readLearnerState} from "../../../lib/learning/learnerState";
import {getStorage} from "../../../storage";
import {getDb} from "../../../storage/dexie/db";
import {notify} from "../../../utils/notify";
import type {ImportedConversationDetail} from "../../../types/domain";

vi.mock("../../../storage", () => ({getStorage: vi.fn()}));
vi.mock("../../../storage/dexie/db", () => ({getDb: vi.fn()}));
vi.mock("../../../chat_import/analysis", () => ({
    analyzeConversation: vi.fn(),
}));
vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: vi.fn(() => ({userId: "u1", language: "en"})),
}));
vi.mock("../../../utils/notify", () => ({
    notify: {
        error: vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
    },
}));

const t = (_key: string, fallback: string) => fallback;

const DETAIL = {
    id: "c1",
    title: "Chat",
    source_language: "de",
    target_language: "fr",
    messages: [{role: "user", content: "Bonjour", timestamp: null}],
} as unknown as ImportedConversationDetail;

const settingsGet = vi.fn();
const saveAnalysis = vi.fn();
const userSettingsFirst = vi.fn();

beforeEach(() => {
    vi.mocked(notify.error).mockClear();
    vi.mocked(notify.warning).mockClear();
    vi.mocked(notify.success).mockClear();
    vi.mocked(analyzeConversation).mockReset();
    vi.mocked(readLearnerState).mockReturnValue({
        userId: "u1",
        language: "en",
    } as unknown as ReturnType<typeof readLearnerState>);
    settingsGet.mockResolvedValue({
        active_provider: "anthropic",
        language: "de",
        model_override_anthropic: "claude-x",
        model_override_openai: null,
        model_override_gemini: null,
    });
    saveAnalysis.mockResolvedValue({
        ...DETAIL,
        analysis_result: {topic: "T"},
    });
    userSettingsFirst.mockResolvedValue({
        user_id: "u1",
        api_key_anthropic: "sk-ant-xxx",
    });
    vi.mocked(getStorage).mockReturnValue({
        settings: {get: settingsGet},
        imports: {saveAnalysis},
    } as unknown as ReturnType<typeof getStorage>);
    vi.mocked(getDb).mockReturnValue({
        userSettings: {
            where: () => ({equals: () => ({first: userSettingsFirst})}),
        },
    } as unknown as ReturnType<typeof getDb>);
});

function mount(detail: ImportedConversationDetail | null = DETAIL) {
    const setDetail = vi.fn();
    const hook = renderHook(() =>
        useConversationAnalysis({
            detail,
            setDetail,
            sourceLang: "de",
            targetLang: "fr",
            lang: "en",
            t,
        }),
    );
    return {hook, setDetail};
}

describe("pure helpers", () => {
    it("pickModelOverride selects the active provider's override", () => {
        const overrides = {
            model_override_anthropic: "a",
            model_override_openai: "o",
            model_override_gemini: "g",
        };
        expect(pickModelOverride("anthropic", overrides)).toBe("a");
        expect(pickModelOverride("openai", overrides)).toBe("o");
        expect(pickModelOverride("gemini", overrides)).toBe("g");
    });

    it("resolveAnalysisLang: UI wins, then settings, then learner, then en", () => {
        expect(resolveAnalysisLang("de", "es", "fr")).toBe("de");
        expect(resolveAnalysisLang("", "es", "fr")).toBe("es");
        expect(resolveAnalysisLang(null, null, "fr")).toBe("fr");
        expect(resolveAnalysisLang(null, undefined, "")).toBe("en");
    });

    it("firstLang: primary, else fallback, else null", () => {
        expect(firstLang("de", "en")).toBe("de");
        expect(firstLang("", "en")).toBe("en");
        expect(firstLang(null, "")).toBeNull();
    });
});

describe("useConversationAnalysis.runAnalysis", () => {
    it("errors out without an active user", async () => {
        vi.mocked(readLearnerState).mockReturnValue({
            userId: null,
        } as unknown as ReturnType<typeof readLearnerState>);
        const {hook} = mount();
        await act(() => hook.result.current.runAnalysis());
        expect(notify.error).toHaveBeenCalledWith("No active user.");
        expect(analyzeConversation).not.toHaveBeenCalled();
    });

    it("warns and never dials the provider without an API key", async () => {
        userSettingsFirst.mockResolvedValue({user_id: "u1"});
        const {hook} = mount();
        await act(() => hook.result.current.runAnalysis());
        expect(notify.warning).toHaveBeenCalled();
        expect(analyzeConversation).not.toHaveBeenCalled();
        expect(hook.result.current.analyzing).toBe(false);
    });

    it("saves the analysis and updates the detail on success", async () => {
        vi.mocked(analyzeConversation).mockResolvedValue({
            topic: "T",
            fallback_used: false,
        } as unknown as Awaited<ReturnType<typeof analyzeConversation>>);
        const {hook, setDetail} = mount();
        await act(() => hook.result.current.runAnalysis());
        expect(analyzeConversation).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "anthropic",
                apiKey: "sk-ant-xxx",
                modelOverride: "claude-x",
                sourceLanguage: "de",
                targetLanguage: "fr",
            }),
        );
        expect(saveAnalysis).toHaveBeenCalledWith("c1", {
            analysis_result: {topic: "T", fallback_used: false},
        });
        expect(notify.success).toHaveBeenCalledWith("Analysis ready.");
        await waitFor(() => {
            expect(setDetail).toHaveBeenCalled();
        });
        expect(hook.result.current.analyzing).toBe(false);
    });

    it("surfaces a provider failure as the inline error, not a toast", async () => {
        vi.mocked(analyzeConversation).mockRejectedValue(
            new Error("provider down"),
        );
        const {hook} = mount();
        await act(() => hook.result.current.runAnalysis());
        expect(hook.result.current.analysisError).toBe(
            "Analysis failed. Please try again.",
        );
        expect(notify.error).not.toHaveBeenCalled();
        expect(hook.result.current.analyzing).toBe(false);
    });
});
