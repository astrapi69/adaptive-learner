/**
 * LessonSummaryScreen completion flow (#1790, #3792).
 *
 * Reaching the summary completes the lesson (#3792): the screen runs the
 * completion once when it mounts, without a button. Pinned here:
 * - success: snapshot before the write, celebration after it
 * - an already completed lesson (a revisit) is not completed again
 * - an anonymous run (#1787) has nowhere to persist it and is skipped
 * - re-renders do not complete twice
 * - failure (#1788): error toast with the reason, celebration and
 *   missions refresh both skipped (early return)
 */

import "@testing-library/jest-dom/vitest";
import {render, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

import LessonSummaryScreen from "./LessonSummaryScreen";
import {
    captureCelebrationSnapshot,
    celebrateProgressSince,
} from "../../../lib/feedback/celebration-stats";
import {notify} from "../../../utils/notify";
import type {ContentLesson, LessonProgress} from "../../../storage/types";

vi.mock("./LessonSummary", () => ({
    default: () => <div data-testid="summary-stub" />,
}));

vi.mock("../steps/LessonResources", () => ({
    default: () => null,
}));

vi.mock("../../../lib/feedback/celebration-stats", () => ({
    captureCelebrationSnapshot: vi.fn(async () => ({snapshot: true})),
    celebrateProgressSince: vi.fn(async () => undefined),
}));

vi.mock("../../../utils/notify", () => ({
    notify: {info: vi.fn(), error: vi.fn(), success: vi.fn()},
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        missions: {
            getDaily: vi.fn(async () => ({
                missions: [],
                newlyCompleted: [],
            })),
        },
    }),
}));

const LESSON = {
    id: "l1",
    title: "Test",
    steps: [],
} as unknown as ContentLesson;

function screenElement(
    markCompleted: () => Promise<unknown>,
    options: {userId?: string; status?: string | null} = {},
) {
    const status = options.status === undefined ? "in_progress" : options.status;
    const progress =
        status === null ? null : ({status} as unknown as LessonProgress);
    return (
        <MemoryRouter>
            <LessonSummaryScreen
                lesson={LESSON}
                originalLesson={LESSON}
                progress={progress}
                lessonMode="practice"
                timedStats={null}
                nextLessonFilename={null}
                userId={options.userId ?? "u1"}
                setId="set-1"
                setTitle="Set"
                source="src/repo"
                setSlug="src--repo"
                lessonFilename="01.json"
                setDomain={null}
                setBook={null}
                markCompleted={markCompleted}
                markRestarted={vi.fn(async () => undefined)}
                goToStep={vi.fn()}
            />
        </MemoryRouter>
    );
}

describe("LessonSummaryScreen completion flow (#3792)", () => {
    beforeEach(() => {
        vi.mocked(captureCelebrationSnapshot).mockClear();
        vi.mocked(celebrateProgressSince).mockClear();
        vi.mocked(notify.error).mockClear();
    });

    it("completes the lesson when the summary is reached: snapshot before, celebration after", async () => {
        const markCompleted = vi.fn(async () => undefined);
        render(screenElement(markCompleted));
        await waitFor(() => {
            expect(celebrateProgressSince).toHaveBeenCalledTimes(1);
        });
        expect(captureCelebrationSnapshot).toHaveBeenCalledWith("u1");
        expect(markCompleted).toHaveBeenCalledTimes(1);
        expect(notify.error).not.toHaveBeenCalled();
    });

    it("completes a lesson that has no progress row yet", async () => {
        const markCompleted = vi.fn(async () => undefined);
        render(screenElement(markCompleted, {status: null}));
        await waitFor(() => {
            expect(markCompleted).toHaveBeenCalledTimes(1);
        });
    });

    it("does not complete an already completed lesson again (a revisit)", async () => {
        const markCompleted = vi.fn(async () => undefined);
        render(screenElement(markCompleted, {status: "completed"}));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(markCompleted).not.toHaveBeenCalled();
        expect(captureCelebrationSnapshot).not.toHaveBeenCalled();
    });

    it("skips an anonymous run, which has nowhere to persist the completion (#1787)", async () => {
        const markCompleted = vi.fn(async () => undefined);
        render(screenElement(markCompleted, {userId: ""}));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(markCompleted).not.toHaveBeenCalled();
    });

    it("completes only once across re-renders", async () => {
        const markCompleted = vi.fn(async () => undefined);
        const {rerender} = render(screenElement(markCompleted));
        rerender(screenElement(markCompleted));
        rerender(screenElement(markCompleted));
        await waitFor(() => {
            expect(celebrateProgressSince).toHaveBeenCalledTimes(1);
        });
        expect(markCompleted).toHaveBeenCalledTimes(1);
    });

    it("toasts the reason and skips the celebration when the write fails (#1788)", async () => {
        const markCompleted = vi.fn(async () => {
            throw new Error("quota exceeded");
        });
        render(screenElement(markCompleted));
        await waitFor(() => {
            expect(notify.error).toHaveBeenCalledTimes(1);
        });
        expect(vi.mocked(notify.error).mock.calls[0][1]).toMatchObject({
            error: {message: "quota exceeded"},
        });
        expect(celebrateProgressSince).not.toHaveBeenCalled();
    });
});
