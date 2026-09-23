/**
 * #3196 — every runner forgets the previous run's hint usage when it starts.
 *
 * ``hint-usage`` is a module-scoped Set shared by all runners; before this
 * fix only ``Lesson.tsx`` cleared it on mount. A hint revealed on exercise
 * ``ex-a`` in a lesson therefore stamped ``hint_used: true`` on the next
 * review / shuffle / endless / adaptive attempt for the same exercise id
 * even when no hint was opened in that run, and the SRS interval was
 * shortened on a clean answer. Each hook clears the Set at the start of
 * its load effect; a hint opened DURING the run still counts, and a plain
 * rerender must not wipe it.
 */

import {renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            reviewQueue: vi.fn().mockResolvedValue([]),
            list: vi.fn().mockResolvedValue([]),
            recordBulk: vi.fn().mockResolvedValue([]),
        },
        contentLoader: {
            listSets: vi.fn().mockResolvedValue([]),
            listLessons: vi.fn().mockResolvedValue([]),
            getLesson: vi.fn().mockResolvedValue(null),
        },
    }),
}));

import {
    clearHintUsage,
    markHintUsed,
    wasHintUsed,
} from "../../../lib/hints/hint-usage";
import {useAdaptiveLesson} from "./useAdaptiveLesson";
import {useEndlessLesson} from "./useEndlessLesson";
import {useReviewLesson} from "./useReviewLesson";
import {useShuffleLesson} from "./useShuffleLesson";

const OPTS = {setId: "es-a1", title: "Run"};

const RUNNERS: ReadonlyArray<[string, () => {status: string}]> = [
    ["review", () => useReviewLesson(OPTS)],
    ["shuffle", () => useShuffleLesson(OPTS)],
    ["endless", () => useEndlessLesson(OPTS)],
    ["adaptive", () => useAdaptiveLesson(OPTS)],
];

describe("hint usage is per run (#3196)", () => {
    beforeEach(() => {
        clearHintUsage();
    });

    it.each(RUNNERS)(
        "%s run start forgets a hint revealed in an earlier run",
        async (_name, useRunner) => {
            markHintUsed("ex-from-previous-run");
            const {result} = renderHook(useRunner);
            await waitFor(() => expect(result.current.status).not.toBe("loading"));
            expect(wasHintUsed("ex-from-previous-run")).toBe(false);
        },
    );

    it.each(RUNNERS)(
        "%s keeps a hint revealed during the run across rerenders",
        async (_name, useRunner) => {
            const {result, rerender} = renderHook(useRunner);
            await waitFor(() => expect(result.current.status).not.toBe("loading"));
            markHintUsed("ex-hinted-now");
            rerender();
            expect(wasHintUsed("ex-hinted-now")).toBe(true);
        },
    );
});
