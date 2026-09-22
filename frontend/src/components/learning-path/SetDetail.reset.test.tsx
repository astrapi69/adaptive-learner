/**
 * SetDetail "Alles wiederholen" (#3171): the button next to "Fehler
 * trainieren", its confirmation dialog, and the reset -> new run ->
 * lesson 1 flow, driven through a mocked ``getStorage`` facade.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router";

import SetDetail from "./SetDetail";
import type {
    PersonalPathLesson,
    PersonalPathSet,
} from "../../lib/learning-path/personal-path";

const listProgress = vi.fn();
const deleteLearningData = vi.fn();
const startRun = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();

vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "learner-1"}),
}));
vi.mock("../../storage", () => ({
    getStorage: () => ({
        lessonProgress: {list: listProgress},
        learningData: {deleteLearningData},
        elementErrors: {startRun},
    }),
}));
vi.mock("../../utils/notify", () => ({
    notify: {
        success: (m: string) => notifySuccess(m),
        error: (m: string) => notifyError(m),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

function lesson(n: number): PersonalPathLesson {
    return {
        source: "src",
        setId: "psych",
        filename: `0${n}.json`,
        number: n,
        title: `Lesson ${n}`,
        stars: 0,
        status: "not_started",
        dot: "not_started",
        receptive: "na",
        productive: "na",
        lastActivity: null,
        isCurrent: false,
    };
}

function setFixture(overrides: Partial<PersonalPathSet> = {}): PersonalPathSet {
    return {
        source: "src",
        setId: "psych",
        title: "Psychologie",
        titleNative: null,
        domain: "psychology",
        sourceLanguage: "de",
        targetLanguage: "de",
        level: "a1",
        lessons: [lesson(1), lesson(2), lesson(3)],
        completedCount: 1,
        totalCount: 3,
        percentComplete: 33,
        lastActivity: "2026-09-20T10:00:00Z",
        downloadedAt: null,
        currentLesson: null,
        mode: "resume",
        errorCount: 0,
        nextLevel: null,
        ...overrides,
    };
}

function progressRow(setId: string, filename: string, correct: number, total: number) {
    return {
        id: `row-${setId}-${filename}`,
        user_id: "learner-1",
        source: "src",
        set_id: setId,
        lesson_filename: filename,
        status: "completed",
        step_results: {},
        score_correct: correct,
        score_total: total,
        time_spent_seconds: 10,
        started_at: "2026-09-20T09:00:00Z",
        updated_at: "2026-09-20T10:00:00Z",
    };
}

function renderDetail(set: PersonalPathSet, onResultsReset?: () => void) {
    return render(
        <MemoryRouter initialEntries={["/learning-path"]}>
            <Routes>
                <Route
                    path="/learning-path"
                    element={<SetDetail set={set} onResultsReset={onResultsReset} />}
                />
                <Route
                    path="/lesson/:slug/:setId/:filename"
                    element={<div data-testid="lesson-target" />}
                />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    listProgress.mockReset();
    deleteLearningData.mockReset();
    startRun.mockReset();
    notifySuccess.mockReset();
    notifyError.mockReset();
    listProgress.mockResolvedValue([
        progressRow("psych", "01.json", 3, 4),
        progressRow("other", "01.json", 4, 4),
    ]);
    deleteLearningData.mockResolvedValue({lessonsDeleted: 1, cardsDeleted: 0});
    startRun.mockResolvedValue({
        id: "run-2",
        user_id: "learner-1",
        set_id: "psych",
        run_id: 2,
        content_version_at_start: null,
        started_at: "2026-09-22T00:00:00Z",
        closed_at: null,
    });
});

describe("SetDetail: Alles wiederholen (#3171)", () => {
    it("offers the reset action for a set with results, hidden for an untouched set", () => {
        const withResults = renderDetail(setFixture());
        expect(screen.getByTestId("set-reset-results-psych")).toBeInTheDocument();
        withResults.unmount();

        renderDetail(setFixture({lastActivity: null, errorCount: 0, completedCount: 0}));
        expect(screen.queryByTestId("set-reset-results-psych")).toBeNull();
    });

    it("opens the confirmation with the set's current average and does nothing on cancel", async () => {
        renderDetail(setFixture());
        fireEvent.click(screen.getByTestId("set-reset-results-psych"));

        const dialog = await screen.findByTestId("reset-set-results-confirm");
        expect(dialog).toHaveTextContent("Psychologie");
        await waitFor(() =>
            expect(screen.getByTestId("reset-set-results-average")).toHaveTextContent("75"),
        );

        fireEvent.click(screen.getByTestId("reset-set-results-confirm-cancel"));
        expect(screen.queryByTestId("reset-set-results-confirm")).toBeNull();
        expect(deleteLearningData).not.toHaveBeenCalled();
        expect(startRun).not.toHaveBeenCalled();
    });

    it("on confirm resets only this set's progress, starts a new run, toasts, notifies and opens lesson 1", async () => {
        const onResultsReset = vi.fn();
        renderDetail(setFixture(), onResultsReset);
        fireEvent.click(screen.getByTestId("set-reset-results-psych"));
        const confirm = await screen.findByTestId("reset-set-results-confirm-confirm");
        await waitFor(() => expect(confirm).toBeEnabled());

        fireEvent.click(confirm);

        await screen.findByTestId("lesson-target");
        expect(deleteLearningData).toHaveBeenCalledWith("learner-1", {
            lessonProgressIds: ["row-psych-01.json"],
            setIds: [],
        });
        expect(startRun).toHaveBeenCalledWith("learner-1", "psych");
        expect(notifySuccess).toHaveBeenCalledTimes(1);
        expect(onResultsReset).toHaveBeenCalledTimes(1);
    });

    it("reports a failed reset and stays on the page", async () => {
        deleteLearningData.mockRejectedValue(new Error("boom"));
        renderDetail(setFixture());
        fireEvent.click(screen.getByTestId("set-reset-results-psych"));
        const confirm = await screen.findByTestId("reset-set-results-confirm-confirm");
        await waitFor(() => expect(confirm).toBeEnabled());

        fireEvent.click(confirm);

        await waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1));
        expect(notifyError.mock.calls[0][0]).toContain("boom");
        expect(startRun).not.toHaveBeenCalled();
        expect(screen.queryByTestId("lesson-target")).toBeNull();
    });
});
