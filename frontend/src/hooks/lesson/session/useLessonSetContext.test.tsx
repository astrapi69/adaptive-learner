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
                    evaluation: {scheme: "pass_fail", pass_percent: 60},
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
        // #3736 - the evaluation block the exam summary applies.
        expect(result.current.setEvaluation).toEqual({scheme: "pass_fail", pass_percent: 60});
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
        expect(result.current.setEvaluation).toBeNull();
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
        expect(result.current.setEvaluation).toBeNull();
    });

    it("skips the reads entirely for empty route params", async () => {
        renderHook(() =>
            useLessonSetContext({source: "", setId: "", filename: ""}),
        );
        expect(listLessons).not.toHaveBeenCalled();
        expect(listSets).not.toHaveBeenCalled();
    });

    it("says the set title is pending until the set listing has answered (#3772)", async () => {
        listLessons.mockResolvedValue({lessons: []});
        let answer: (value: {sets: {id: string; title: string}[]}) => void = () => undefined;
        listSets.mockReturnValue(
            new Promise((resolve) => {
                answer = resolve;
            }),
        );
        const {result} = renderHook(() => useLessonSetContext(ARGS));

        expect(result.current.setTitlePending).toBe(true);
        expect(result.current.setTitle).toBeNull();

        answer({sets: [{id: ARGS.setId, title: "A set"}]});
        await waitFor(() => expect(result.current.setTitlePending).toBe(false));
        expect(result.current.setTitle).toBe("A set");
    });

    it("stops being pending when the set listing fails (#3772)", async () => {
        listLessons.mockResolvedValue({lessons: []});
        listSets.mockRejectedValue(new Error("offline"));
        const {result} = renderHook(() => useLessonSetContext(ARGS));

        await waitFor(() => expect(result.current.setTitlePending).toBe(false));
        expect(result.current.setTitle).toBeNull();
    });

    it("is not pending for a lesson without a set (#3772)", () => {
        listLessons.mockResolvedValue({lessons: []});
        const {result} = renderHook(() => useLessonSetContext({...ARGS, setId: ""}));

        expect(result.current.setTitlePending).toBe(false);
    });
});
