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
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

import ContinueLearning from "./ContinueLearning";
import type {LessonProgress} from "../../storage/types";

const listProgressMock = vi.fn();
const listSetsMock = vi.fn();
const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        lessonProgress: {list: listProgressMock},
        contentLoader: {
            listSets: listSetsMock,
            listLessons: listLessonsMock,
            getLesson: getLessonMock,
        },
    }),
}));

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb: string) => fb, lang: "en"}),
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
    listSetsMock.mockResolvedValue({sets: [], sources: []});
    listLessonsMock.mockResolvedValue({lessons: []});
    getLessonMock.mockResolvedValue(null);
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
