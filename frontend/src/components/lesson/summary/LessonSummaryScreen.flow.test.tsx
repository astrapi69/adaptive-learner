/**
 * LessonSummaryScreen mark-complete flow (#1790).
 *
 * Pins the celebration flow AROUND markCompleted at screen level -
 * the layer above the #1787 button-gate pin in
 * LessonSummary.markComplete.test.tsx:
 * - success: snapshot before the write, celebration after it
 * - failure (#1788): error toast with the reason, celebration and
 *   missions refresh both skipped (early return)
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import LessonSummaryScreen from "./LessonSummaryScreen";
import {
    captureCelebrationSnapshot,
    celebrateProgressSince,
} from "../../../lib/feedback/celebration-stats";
import {notify} from "../../../utils/notify";
import type {ContentLesson} from "../../../storage/types";

vi.mock("./LessonSummary", () => ({
    default: ({onMarkComplete}: {onMarkComplete: () => void}) => (
        <button
            type="button"
            data-testid="summary-stub-complete"
            onClick={() => void onMarkComplete()}
        >
            complete
        </button>
    ),
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

function renderScreen(markCompleted: () => Promise<unknown>) {
    return render(
        <MemoryRouter>
            <LessonSummaryScreen
                lesson={LESSON}
                originalLesson={LESSON}
                progress={null}
                lessonMode="practice"
                timedStats={null}
                nextLessonFilename={null}
                userId="u1"
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
        </MemoryRouter>,
    );
}

describe("LessonSummaryScreen mark-complete flow", () => {
    beforeEach(() => {
        vi.mocked(captureCelebrationSnapshot).mockClear();
        vi.mocked(celebrateProgressSince).mockClear();
        vi.mocked(notify.error).mockClear();
    });

    it("snapshots before the write and celebrates after a successful completion", async () => {
        const markCompleted = vi.fn(async () => undefined);
        renderScreen(markCompleted);
        fireEvent.click(screen.getByTestId("summary-stub-complete"));
        await waitFor(() => {
            expect(celebrateProgressSince).toHaveBeenCalledTimes(1);
        });
        expect(captureCelebrationSnapshot).toHaveBeenCalledWith("u1");
        expect(markCompleted).toHaveBeenCalledTimes(1);
        expect(notify.error).not.toHaveBeenCalled();
    });

    it("toasts the reason and skips the celebration when the write fails (#1788)", async () => {
        const markCompleted = vi.fn(async () => {
            throw new Error("quota exceeded");
        });
        renderScreen(markCompleted);
        fireEvent.click(screen.getByTestId("summary-stub-complete"));
        await waitFor(() => {
            expect(notify.error).toHaveBeenCalledTimes(1);
        });
        expect(String(vi.mocked(notify.error).mock.calls[0][0])).toMatch(
            /quota exceeded/,
        );
        expect(celebrateProgressSince).not.toHaveBeenCalled();
    });
});
