/**
 * useLessonSetContext (#1790).
 *
 * Pins the three silent-degrade mount reads: the next-lesson pointer
 * (successor / last-in-set / storage failure) and the set
 * title/domain/book resolution (match / miss / failure).
 */

import {renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useLessonSetContext} from "./useLessonSetContext";
import {getStorage} from "../../../storage";

vi.mock("../../../storage", () => ({
    getStorage: vi.fn(),
}));

const listLessons = vi.fn();
const listSets = vi.fn();

beforeEach(() => {
    listLessons.mockReset();
    listSets.mockReset();
    vi.mocked(getStorage).mockReturnValue({
        contentLoader: {listLessons, listSets},
    } as unknown as ReturnType<typeof getStorage>);
});

const ARGS = {source: "src/repo", setId: "set-1", filename: "02.json"};

describe("useLessonSetContext", () => {
    it("resolves the successor filename and the set metadata", async () => {
        listLessons.mockResolvedValue({
            lessons: ["01.json", "02.json", "03.json"],
        });
        listSets.mockResolvedValue({
            sets: [
                {
                    id: "set-1",
                    title: "Französisch A1",
                    domain: "language",
                    book: {title: "Grammaire"},
                },
            ],
        });
        const {result} = renderHook(() => useLessonSetContext(ARGS));
        await waitFor(() => {
            expect(result.current.nextLessonFilename).toBe("03.json");
        });
        await waitFor(() => {
            expect(result.current.setTitle).toBe("Französisch A1");
        });
        expect(result.current.setDomain).toBe("language");
        expect(result.current.setBook).toEqual({title: "Grammaire"});
    });

    it("returns null for the last lesson in the set", async () => {
        listLessons.mockResolvedValue({lessons: ["01.json", "02.json"]});
        listSets.mockResolvedValue({sets: []});
        const {result} = renderHook(() => useLessonSetContext(ARGS));
        await waitFor(() => {
            expect(listLessons).toHaveBeenCalled();
        });
        expect(result.current.nextLessonFilename).toBeNull();
        expect(result.current.setTitle).toBeNull();
    });

    it("degrades silently when both storage reads fail", async () => {
        listLessons.mockRejectedValue(new Error("offline"));
        listSets.mockRejectedValue(new Error("offline"));
        const {result} = renderHook(() => useLessonSetContext(ARGS));
        await waitFor(() => {
            expect(listSets).toHaveBeenCalled();
        });
        expect(result.current.nextLessonFilename).toBeNull();
        expect(result.current.setTitle).toBeNull();
        expect(result.current.setDomain).toBeNull();
        expect(result.current.setBook).toBeNull();
    });

    it("skips the reads entirely for empty route params", async () => {
        renderHook(() =>
            useLessonSetContext({source: "", setId: "", filename: ""}),
        );
        expect(listLessons).not.toHaveBeenCalled();
        expect(listSets).not.toHaveBeenCalled();
    });
});
