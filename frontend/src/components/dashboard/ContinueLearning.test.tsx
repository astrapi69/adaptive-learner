/**
 * Tests for the ContinueLearning section (UX overhaul C2/C3/C4).
 *
 * Pins:
 * - userId empty → renders nothing.
 * - No recent activity + showWhenEmpty=false → renders nothing.
 * - No recent activity + showWhenEmpty=true → friendly empty state
 *   linking to /content.
 * - Recent activity → one row per set, newest-first, with the set
 *   title + a working /lesson link.
 * - A resumed (in-progress) lesson links to that lesson; a completed
 *   lesson links to the NEXT lesson in the set.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";

import {notifyLessonProgressChanged} from "../../lib/lesson/progress/progress-change-event";
import {MemoryRouter} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

import ContinueLearning from "./ContinueLearning";
import {dismissContinueRow} from "../../lib/content/browse/prefs/continue-dismissed-store";
import {storeSetStatus} from "../../lib/content/browse/lifecycle/set-status-store";
import type {LessonProgress} from "../../storage/types";

const listProgressMock = vi.fn();
const listSetsMock = vi.fn();
const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const reviewQueueMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        lessonProgress: {list: listProgressMock},
        contentLoader: {
            listSets: listSetsMock,
            listLessons: listLessonsMock,
            getLesson: getLessonMock,
        },
        elementErrors: {reviewQueue: reviewQueueMock},
    }),
}));

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb: string) => fb, lang: "en"}),
}));

vi.mock("../../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn()},
}));

function progress(over: Partial<LessonProgress> & {
    set_id: string;
    lesson_filename: string;
    updated_at: string;
}): LessonProgress {
    return {
        id: `${over.set_id}#${over.lesson_filename}`,
        user_id: "u1",
        source: over.source ?? "owner/repo",
        status: "in_progress",
        step_results: {},
        score_correct: 0,
        score_total: 1,
        time_spent_seconds: 0,
        started_at: "2026-06-01T09:00:00Z",
        completed_at: null,
        paused_at: null,
        abandoned_at: null,
        ...over,
    };
}

function renderSection(props: {
    userId?: string;
    maxItems?: number;
    showWhenEmpty?: boolean;
}) {
    return render(
        <MemoryRouter>
            <ContinueLearning
                userId={props.userId ?? "u1"}
                maxItems={props.maxItems}
                showWhenEmpty={props.showWhenEmpty}
            />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    listProgressMock.mockReset();
    listSetsMock.mockReset();
    listLessonsMock.mockReset();
    getLessonMock.mockReset();
    reviewQueueMock.mockReset();
    localStorage.clear();
    listSetsMock.mockResolvedValue({sets: [], sources: []});
    listLessonsMock.mockResolvedValue({lessons: []});
    getLessonMock.mockResolvedValue(null);
    reviewQueueMock.mockResolvedValue([]);
});

describe("ContinueLearning", () => {
    it("renders nothing when userId is empty", () => {
        renderSection({userId: ""});
        expect(screen.queryByTestId("continue-learning")).not.toBeInTheDocument();
    });

    it("renders nothing on no activity when showWhenEmpty=false", async () => {
        listProgressMock.mockResolvedValue([]);
        renderSection({showWhenEmpty: false});
        // Give the effect a tick; the section must stay absent.
        await waitFor(() =>
            expect(listProgressMock).toHaveBeenCalled(),
        );
        expect(screen.queryByTestId("continue-learning")).not.toBeInTheDocument();
    });

    it("shows a friendly empty state when showWhenEmpty=true", async () => {
        listProgressMock.mockResolvedValue([]);
        renderSection({showWhenEmpty: true});
        const link = await screen.findByTestId("continue-learning-empty-link");
        expect(link).toHaveAttribute("href", "/content?tab=my");
    });

    it("shows a resume row linking to the in-progress lesson", async () => {
        listProgressMock.mockResolvedValue([
            progress({set_id: "fr-a1", lesson_filename: "02.json", updated_at: "2026-06-03T10:00:00Z"}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "fr-a1", title: "French A1"}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json", "03.json"]});
        getLessonMock.mockResolvedValue({id: "02", title: "Greetings", steps: [{}, {}], cards: []});

        renderSection({});
        const link = await screen.findByTestId("continue-learning-link-fr-a1");
        expect(link).toHaveAttribute("href", "/lesson/owner--repo/fr-a1/02.json");
        expect(screen.getByText(/French A1/)).toBeInTheDocument();
        expect(screen.getByTestId("continue-learning-resume-fr-a1")).toBeInTheDocument();
    });

    it("links a completed lesson to the NEXT lesson in the set", async () => {
        listProgressMock.mockResolvedValue([
            progress({
                set_id: "fr-a1",
                lesson_filename: "01.json",
                updated_at: "2026-06-03T10:00:00Z",
                status: "completed",
                score_correct: 10,
                score_total: 10,
            }),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "fr-a1", title: "French A1"}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json"]});
        getLessonMock.mockResolvedValue({id: "x", title: "T", steps: [], cards: []});

        renderSection({});
        const link = await screen.findByTestId("continue-learning-link-fr-a1");
        expect(link).toHaveAttribute("href", "/lesson/owner--repo/fr-a1/02.json");
        expect(screen.getByTestId("continue-learning-next-fr-a1")).toBeInTheDocument();
    });

    it("shows a friendly label for a legacy analysis-<uuid> set, not the raw id", async () => {
        // Legacy data (pre-#134): a chat-import analysis set's title was
        // stored as its raw ``analysis-<uuid>`` id. #368 — show a friendly
        // label instead of the bare id on the dashboard.
        const legacyId = "analysis-ed08d0f5-12f3-46ac-a524-381f42aab115";
        listProgressMock.mockResolvedValue([
            progress({set_id: legacyId, lesson_filename: "01.json", updated_at: "2026-06-03T10:00:00Z"}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: legacyId, title: legacyId}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json"]});
        getLessonMock.mockResolvedValue({id: "01", title: "Deutsche Grammatik", steps: [{}], cards: []});

        renderSection({});
        const link = await screen.findByTestId(`continue-learning-link-${legacyId}`);
        expect(link.textContent).toContain("Imported analysis");
        expect(link.textContent).not.toContain(legacyId);
    });

    // #1328 — long titles must stay inside the card on narrow viewports.
    // happy-dom has no layout engine, so we pin the structural containment
    // classes (min-w-0 + truncate) that prevent the horizontal overflow,
    // plus the native `title` tooltip that preserves the full name.
    const LONG =
        "Psychologie der Beeinflussung - Wiederholung und Vertiefung der Prinzipien";

    it("truncates a long resume-row title and keeps the row shrinkable", async () => {
        listProgressMock.mockResolvedValue([
            progress({set_id: "psy", lesson_filename: "02.json", updated_at: "2026-06-03T10:00:00Z"}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "psy", title: LONG}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json", "03.json"]});
        getLessonMock.mockResolvedValue({id: "02", title: LONG, steps: [{}, {}], cards: []});

        renderSection({});
        const link = await screen.findByTestId("continue-learning-link-psy");
        // The row link must be allowed to shrink below its content width.
        expect(link.className).toContain("min-w-0");
        // The title line truncates and exposes the full text via `title`.
        const title = screen.getByTitle(`${LONG} - ${LONG}`);
        expect(title.className).toContain("truncate");
    });

    it("truncates a long next-lesson title while keeping the stars", async () => {
        listProgressMock.mockResolvedValue([
            progress({
                set_id: "psy",
                lesson_filename: "01.json",
                updated_at: "2026-06-03T10:00:00Z",
                status: "completed",
                score_correct: 10,
                score_total: 10,
            }),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "psy", title: "Psychologie"}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json"]});
        getLessonMock.mockResolvedValue({id: "x", title: LONG, steps: [], cards: []});

        renderSection({});
        await screen.findByTestId("continue-learning-next-psy");
        const nextTitle = screen.getByTitle(`Next Lesson: ${LONG}`);
        expect(nextTitle.className).toContain("truncate");
        expect(nextTitle.className).toContain("min-w-0");
    });

    it("leaves a short title fully rendered (no regression)", async () => {
        listProgressMock.mockResolvedValue([
            progress({set_id: "fr-a1", lesson_filename: "02.json", updated_at: "2026-06-03T10:00:00Z"}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "fr-a1", title: "French A1"}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json"]});
        getLessonMock.mockResolvedValue({id: "02", title: "Greetings", steps: [{}], cards: []});

        renderSection({});
        await screen.findByTestId("continue-learning-link-fr-a1");
        expect(screen.getByText(/French A1/)).toBeInTheDocument();
        expect(screen.getByTitle("French A1 - Greetings")).toBeInTheDocument();
    });

    it("keeps every row shrinkable when several cards are shown", async () => {
        listProgressMock.mockResolvedValue([
            progress({set_id: "a", lesson_filename: "01.json", updated_at: "2026-06-01T10:00:00Z"}),
            progress({set_id: "b", lesson_filename: "01.json", updated_at: "2026-06-03T10:00:00Z"}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [
                {source: "owner/repo", id: "a", title: LONG},
                {source: "owner/repo", id: "b", title: LONG},
            ],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json"]});
        getLessonMock.mockResolvedValue({id: "01", title: LONG, steps: [{}], cards: []});

        renderSection({maxItems: 3});
        await screen.findByTestId("continue-learning-list");
        const links = screen.getAllByTestId(/^continue-learning-link-/);
        expect(links.length).toBe(2);
        for (const link of links) {
            expect(link.className).toContain("min-w-0");
        }
    });

    it("lists one row per set, newest-first, capped at maxItems", async () => {
        listProgressMock.mockResolvedValue([
            progress({set_id: "a", lesson_filename: "01.json", updated_at: "2026-06-01T10:00:00Z"}),
            progress({set_id: "b", lesson_filename: "01.json", updated_at: "2026-06-03T10:00:00Z"}),
            progress({set_id: "c", lesson_filename: "01.json", updated_at: "2026-06-02T10:00:00Z"}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [
                {source: "owner/repo", id: "a", title: "A"},
                {source: "owner/repo", id: "b", title: "B"},
                {source: "owner/repo", id: "c", title: "C"},
            ],
            sources: [],
        });
        renderSection({maxItems: 2});
        await screen.findByTestId("continue-learning-list");
        const items = screen.getAllByTestId(/^continue-learning-item-/);
        expect(items).toHaveLength(2);
        // Newest (b) first, then (c). "a" is dropped by the cap.
        expect(items[0]).toHaveAttribute("data-testid", "continue-learning-item-b");
        expect(items[1]).toHaveAttribute("data-testid", "continue-learning-item-c");
    });

    // #3020 - a finished set is TAGGED as finished instead of vanishing.
    it("tags a completed set with no due reviews as finished", async () => {
        listProgressMock.mockResolvedValue([
            progress({
                set_id: "done",
                lesson_filename: "01.json",
                updated_at: "2026-06-03T10:00:00Z",
                status: "completed",
                score_correct: 10,
                score_total: 10,
            }),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "done", title: "Finished"}],
            sources: [],
        });
        // Single lesson, completed → resolves to set_complete (finished set).
        listLessonsMock.mockResolvedValue({lessons: ["01.json"]});
        reviewQueueMock.mockResolvedValue([]);

        renderSection({showWhenEmpty: true});
        const badge = await screen.findByTestId("continue-learning-badge-done");
        expect(badge).toHaveTextContent("Set completed");
        // Revisiting the finished set stays possible.
        expect(
            screen.getByTestId("continue-learning-link-done"),
        ).toHaveAttribute("href", "/lesson/owner--repo/done/01.json");
        // Not the empty state any more - there IS something to report.
        expect(
            screen.queryByTestId("continue-learning-empty-link"),
        ).not.toBeInTheDocument();
    });

    // #2123 stays pinned: the finish is reported, never as the top action.
    it("keeps a still-open set above the finished tag", async () => {
        listProgressMock.mockResolvedValue([
            progress({
                set_id: "done",
                lesson_filename: "01.json",
                updated_at: "2026-06-09T10:00:00Z",
                status: "completed",
                score_correct: 10,
                score_total: 10,
            }),
            progress({set_id: "open", lesson_filename: "02.json", updated_at: "2026-06-01T10:00:00Z"}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [
                {source: "owner/repo", id: "done", title: "Finished"},
                {source: "owner/repo", id: "open", title: "Open"},
            ],
            sources: [],
        });
        listLessonsMock.mockImplementation(async (_src: string, setId: string) =>
            setId === "done"
                ? {lessons: ["01.json"]}
                : {lessons: ["01.json", "02.json", "03.json"]},
        );
        reviewQueueMock.mockResolvedValue([]);

        renderSection({});
        await screen.findByTestId("continue-learning-item-open");
        const items = screen.getAllByRole("listitem");
        expect(items[0]).toHaveAttribute("data-testid", "continue-learning-item-open");
        expect(items[1]).toHaveAttribute("data-testid", "continue-learning-item-done");
    });

    // #2123 — a completed set IS worth surfacing when cards are due, but as a
    // review nudge routed to the review session, not a "Set completed" row.
    it("surfaces a completed set with due reviews as a review row to /review", async () => {
        listProgressMock.mockResolvedValue([
            progress({
                set_id: "done",
                lesson_filename: "01.json",
                updated_at: "2026-06-03T10:00:00Z",
                status: "completed",
                score_correct: 10,
                score_total: 10,
            }),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "done", title: "Finished"}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json"]});
        getLessonMock.mockResolvedValue({id: "01", title: "T", steps: [{}], cards: []});
        reviewQueueMock.mockResolvedValue([
            {element_key: "e1", set_id: "done", overdue: true},
            {element_key: "e2", set_id: "done", overdue: true},
        ]);

        renderSection({});
        const link = await screen.findByTestId("continue-learning-link-done");
        expect(link).toHaveAttribute("href", "/review/done");
        const review = screen.getByTestId("continue-learning-review-done");
        expect(review.textContent).toContain("2");
    });

    // #2123 — a deferred set the learner set aside is not proposed when idle.
    it("drops a deferred set with no due reviews", async () => {
        localStorage.clear();
        storeSetStatus("owner/repo", "later", "deferred", localStorage);
        listProgressMock.mockResolvedValue([
            progress({set_id: "later", lesson_filename: "02.json", updated_at: "2026-06-03T10:00:00Z"}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "later", title: "Later"}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json", "03.json"]});
        reviewQueueMock.mockResolvedValue([]);

        renderSection({showWhenEmpty: true});
        await screen.findByTestId("continue-learning-empty-link");
        expect(
            screen.queryByTestId("continue-learning-item-later"),
        ).not.toBeInTheDocument();
    });

    // #3023 - every row carries an X that takes it out of the block.
    it("removes a row when its X is clicked and keeps it away on reload", async () => {
        listProgressMock.mockResolvedValue([
            progress({set_id: "fr-a1", lesson_filename: "02.json", updated_at: "2026-06-03T10:00:00Z"}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "fr-a1", title: "French A1"}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json", "03.json"]});

        const {unmount} = renderSection({});
        const dismiss = await screen.findByTestId("continue-learning-dismiss-fr-a1");
        fireEvent.click(dismiss);
        await waitFor(() =>
            expect(
                screen.queryByTestId("continue-learning-item-fr-a1"),
            ).not.toBeInTheDocument(),
        );

        // The decision is persisted: a fresh mount does not bring the row back.
        unmount();
        renderSection({showWhenEmpty: true});
        await screen.findByTestId("continue-learning-empty-link");
        expect(
            screen.queryByTestId("continue-learning-item-fr-a1"),
        ).not.toBeInTheDocument();
    });

    it("brings a dismissed row back when the set is touched again (#3023)", async () => {
        dismissContinueRow("owner/repo", "fr-a1", "2026-06-03T10:00:00Z", localStorage);
        listProgressMock.mockResolvedValue([
            // Newer activity than the dismissal - the learner came back to it.
            progress({set_id: "fr-a1", lesson_filename: "02.json", updated_at: "2026-06-05T09:00:00Z"}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "fr-a1", title: "French A1"}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json", "03.json"]});

        renderSection({});
        expect(
            await screen.findByTestId("continue-learning-item-fr-a1"),
        ).toBeInTheDocument();
    });

    it("offers the X on a completed row too (#3023)", async () => {
        listProgressMock.mockResolvedValue([
            progress({
                set_id: "done",
                lesson_filename: "01.json",
                updated_at: "2026-06-03T10:00:00Z",
                status: "completed",
                score_correct: 10,
                score_total: 10,
            }),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "done", title: "Finished"}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json"]});

        renderSection({});
        expect(
            await screen.findByTestId("continue-learning-dismiss-done"),
        ).toBeInTheDocument();
    });

    it("hides progress whose source repo was removed (#1445)", async () => {
        listProgressMock.mockResolvedValue([
            progress({source: "owner/repo", set_id: "fr-a1", lesson_filename: "01.json", updated_at: "2026-06-03T10:00:00Z"}),
            progress({source: "jane/removed", set_id: "orphan", lesson_filename: "01.json", updated_at: "2026-06-04T10:00:00Z"}),
        ]);
        // Only owner/repo is still loadable; jane/removed is gone from listSets.
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "fr-a1", title: "French A1"}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json"]});
        getLessonMock.mockResolvedValue({id: "01", title: "Greetings", steps: [{}], cards: []});

        renderSection({});
        await screen.findByTestId("continue-learning-list");
        const items = screen.getAllByTestId(/^continue-learning-item-/);
        // Only the loadable set survives; the orphaned "jane/removed" row is
        // hidden even though it is newer.
        expect(items).toHaveLength(1);
        expect(items[0]).toHaveAttribute("data-testid", "continue-learning-item-fr-a1");
    });
});

describe("ContinueLearning re-reads on a lesson-progress write (#3075)", () => {
    it("re-runs its load when a write is announced", async () => {
        listProgressMock.mockResolvedValue([]);
        renderSection({showWhenEmpty: true});
        await screen.findByTestId("continue-learning-empty-link");
        expect(listProgressMock).toHaveBeenCalledTimes(1);

        listProgressMock.mockResolvedValue([
            progress({set_id: "fr-a1", lesson_filename: "02.json", updated_at: "2026-06-03T10:00:00Z", status: "paused"}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "fr-a1", title: "French A1"}],
            sources: [],
        });
        act(() => {
            notifyLessonProgressChanged();
        });

        expect(await screen.findByTestId("continue-learning-resume-fr-a1")).toBeInTheDocument();
        expect(listProgressMock).toHaveBeenCalledTimes(2);
    });
});

describe("ContinueLearning resume step counter (#3076)", () => {
    it("names the step the resume lands on, not the number of graded exercises", async () => {
        // One graded exercise (index 2) and a persisted position on the
        // theory step after it (index 3): the lesson reopens on step 4 of 8.
        listProgressMock.mockResolvedValue([
            progress({
                set_id: "fr-a1",
                lesson_filename: "02.json",
                updated_at: "2026-06-03T10:00:00Z",
                status: "paused",
                step_results: {"ex-match": {correct: 1, total: 1, attempts: 1, completed_at: "2026-06-03T09:00:00Z"}},
                current_step: 3,
            }),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [{source: "owner/repo", id: "fr-a1", title: "French A1"}],
            sources: [],
        });
        listLessonsMock.mockResolvedValue({lessons: ["01.json", "02.json"]});
        getLessonMock.mockResolvedValue({
            id: "02",
            title: "Greetings",
            cards: [],
            steps: [
                {id: "intro"}, {id: "formality"}, {id: "ex-match"}, {id: "merci"},
                {id: "ex-cloze"}, {id: "numbers"}, {id: "ex-tiles"}, {id: "outro"},
            ],
        });

        renderSection({});
        const link = await screen.findByTestId("continue-learning-link-fr-a1");
        expect(link.textContent).toContain("Step 4/8");
        expect(link.textContent).not.toContain("Step 1/8");
    });
});
