/**
 * useImportLanguagePair (#1799).
 *
 * Pins the v1.54.0 import-time pair at hook level: saved values win,
 * detection fills a missing target, edits persist onto the import
 * record, and a failed persist keeps the in-memory selection.
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useImportLanguagePair} from "./useImportLanguagePair";
import {getStorage} from "../../../storage";
import type {ImportedConversationDetail} from "../../../types/domain";

vi.mock("../../../storage", () => ({
    getStorage: vi.fn(),
}));

vi.mock("../../../lib/content/language/detect-chat-language", () => ({
    detectLearningLanguage: vi.fn(() => "fr"),
}));

const updateImport = vi.fn(async () => undefined);

beforeEach(() => {
    updateImport.mockClear();
    updateImport.mockResolvedValue(undefined);
    vi.mocked(getStorage).mockReturnValue({
        imports: {update: updateImport},
    } as unknown as ReturnType<typeof getStorage>);
});

function conversation(
    overrides: Partial<ImportedConversationDetail> = {},
): ImportedConversationDetail {
    return {
        id: "c1",
        title: "Chat",
        source_language: null,
        target_language: null,
        messages: [{role: "user", content: "Bonjour, ça va?"}],
        ...overrides,
    } as unknown as ImportedConversationDetail;
}

describe("useImportLanguagePair", () => {
    it("keeps saved languages when the conversation carries a pair", () => {
        const detail = conversation({
            source_language: "de-DE",
            target_language: "es",
        });
        const {result} = renderHook(() =>
            useImportLanguagePair({detail, setDetail: vi.fn(), lang: "en"}),
        );
        expect(result.current.sourceLang).toBe("de");
        expect(result.current.targetLang).toBe("es");
    });

    it("defaults source to the app language and detects the target", () => {
        const {result} = renderHook(() =>
            useImportLanguagePair({
                detail: conversation(),
                setDetail: vi.fn(),
                lang: "de-DE",
            }),
        );
        expect(result.current.sourceLang).toBe("de");
        expect(result.current.targetLang).toBe("fr");
    });

    it("persists an edit and mirrors it onto the detail record", async () => {
        const setDetail = vi.fn();
        const {result} = renderHook(() =>
            useImportLanguagePair({
                detail: conversation(),
                setDetail,
                lang: "en",
            }),
        );
        act(() => result.current.changeTarget("es"));
        expect(result.current.targetLang).toBe("es");
        await waitFor(() => {
            expect(updateImport).toHaveBeenCalledWith("c1", {
                source_language: "en",
                target_language: "es",
            });
        });
        expect(setDetail).toHaveBeenCalledWith(
            expect.objectContaining({target_language: "es"}),
        );
    });

    it("keeps the in-memory selection when the persist write fails", async () => {
        updateImport.mockRejectedValue(new Error("offline"));
        const setDetail = vi.fn();
        const {result} = renderHook(() =>
            useImportLanguagePair({
                detail: conversation(),
                setDetail,
                lang: "en",
            }),
        );
        act(() => result.current.changeSource("pt"));
        await waitFor(() => {
            expect(updateImport).toHaveBeenCalled();
        });
        expect(result.current.sourceLang).toBe("pt");
        expect(setDetail).not.toHaveBeenCalled();
    });
});
