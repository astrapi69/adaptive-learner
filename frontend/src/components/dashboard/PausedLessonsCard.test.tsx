/**
 * Tests for the PausedLessonsCard dashboard widget
 * (Phase 63D / EXP-020).
 *
 * Pins:
 * - Returns null (hidden) when userId is empty
 * - Returns null when no paused lessons exist
 * - Renders paused lessons, ordered most-recent-first
 * - Caps at MAX_SHOWN (5) items
 * - Each item links to the correct /lesson/... URL
 * - Failure-tolerant (returns null on storage error)
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import PausedLessonsCard from "./PausedLessonsCard";
import {RETENTION_PREF_KEY} from "../../lib/learning/pausedRetentionPref";
import type {LessonProgress} from "../../storage/types";

const listMock = vi.fn();
const upsertMock = vi.fn();
const listSetsMock = vi.fn();
const getLessonMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        lessonProgress: {list: listMock, upsert: upsertMock},
        contentLoader: {listSets: listSetsMock, getLesson: getLessonMock},
    }),
}));

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb: string) => fb, lang: "en"}),
}));

beforeEach(() => {
    listMock.mockReset();
    upsertMock.mockReset().mockResolvedValue(undefined);
    // Default: no cached set titles, no cached lesson detail — rows then fall
    // back to filename-derived labels (or the opaque-id guard).
    listSetsMock.mockReset().mockResolvedValue({sets: []});
    getLessonMock.mockReset().mockResolvedValue(null);
    // #1312 — disable the age-based retention cutoff so the fixtures' absolute
    // paused_at dates never straddle ``Date.now() - DEFAULT_RETENTION_DAYS`` and
    // get auto-abandoned. Without this the fixed 2026-06-01 dates rot into a
    // non-deterministic failure once real time passes the 30-day window.
    localStorage.setItem(RETENTION_PREF_KEY, "0");
});

function _progress(
    filename: string,
    status: LessonProgress["status"] = "paused",
    pausedAt: string | null = "2026-06-01T10:00:00Z",
): LessonProgress {
    return {
        id: `user-1#owner--repo#fr-a1#${filename}`,
        user_id: "user-1",
        source: "owner/repo",
        set_id: "fr-a1",
        lesson_filename: filename,
        status,
        step_results: {},
        score_correct: 0,
        score_total: 1,
        time_spent_seconds: 60,
        started_at: "2026-06-01T09:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
        completed_at: null,
        paused_at: pausedAt,
        abandoned_at: null,
    };
}

describe("PausedLessonsCard", () => {
    it("renders nothing when userId is empty", () => {
        render(
            <MemoryRouter>
                <PausedLessonsCard userId="" />
            </MemoryRouter>,
        );
        expect(
            screen.queryByTestId("paused-lessons-card"),
        ).not.toBeInTheDocument();
        expect(listMock).not.toHaveBeenCalled();
    });

    it("renders nothing when no paused lessons exist", async () => {
        listMock.mockResolvedValue([
            _progress("01-greetings.json", "completed"),
        ]);
        render(
            <MemoryRouter>
                <PausedLessonsCard userId="user-1" />
            </MemoryRouter>,
        );
        await waitFor(() => expect(listMock).toHaveBeenCalled());
        expect(
            screen.queryByTestId("paused-lessons-card"),
        ).not.toBeInTheDocument();
    });

    it("renders paused lessons sorted most-recent-first", async () => {
        listMock.mockResolvedValue([
            _progress("01.json", "paused", "2026-06-01T08:00:00Z"),
            _progress("02.json", "paused", "2026-06-01T10:00:00Z"),
            _progress("03.json", "paused", "2026-06-01T09:00:00Z"),
        ]);
        render(
            <MemoryRouter>
                <PausedLessonsCard userId="user-1" />
            </MemoryRouter>,
        );
        await waitFor(() =>
            expect(
                screen.queryByTestId("paused-lessons-card"),
            ).toBeInTheDocument(),
        );
        const items = screen.getAllByRole("listitem");
        // 02 (10:00) → 03 (09:00) → 01 (08:00)
        expect(items[0]).toHaveAttribute(
            "data-testid",
            "paused-lesson-02.json",
        );
        expect(items[1]).toHaveAttribute(
            "data-testid",
            "paused-lesson-03.json",
        );
        expect(items[2]).toHaveAttribute(
            "data-testid",
            "paused-lesson-01.json",
        );
    });

    it("caps the list at 5 items", async () => {
        listMock.mockResolvedValue(
            Array.from({length: 7}, (_, i) =>
                _progress(`${String(i).padStart(2, "0")}.json`, "paused"),
            ),
        );
        render(
            <MemoryRouter>
                <PausedLessonsCard userId="user-1" />
            </MemoryRouter>,
        );
        await waitFor(() =>
            expect(
                screen.queryByTestId("paused-lessons-list"),
            ).toBeInTheDocument(),
        );
        expect(screen.getAllByRole("listitem")).toHaveLength(5);
    });

    it("links to the correct lesson URL", async () => {
        listMock.mockResolvedValue([
            _progress("01-greetings.json"),
        ]);
        render(
            <MemoryRouter>
                <PausedLessonsCard userId="user-1" />
            </MemoryRouter>,
        );
        await waitFor(() =>
            expect(
                screen.queryByTestId(
                    "paused-lesson-resume-01-greetings.json",
                ),
            ).toBeInTheDocument(),
        );
        expect(
            screen.getByTestId("paused-lesson-resume-01-greetings.json"),
        ).toHaveAttribute(
            "href",
            "/lesson/owner--repo/fr-a1/01-greetings.json",
        );
    });

    it("renders nothing on storage error (failure-tolerant)", async () => {
        listMock.mockRejectedValue(new Error("Network error"));
        render(
            <MemoryRouter>
                <PausedLessonsCard userId="user-1" />
            </MemoryRouter>,
        );
        await waitFor(() => expect(listMock).toHaveBeenCalled());
        expect(
            screen.queryByTestId("paused-lessons-card"),
        ).not.toBeInTheDocument();
    });

    it("shows the cached lesson + set title, not the raw filename/id", async () => {
        listMock.mockResolvedValue([_progress("01-greetings.json")]);
        listSetsMock.mockResolvedValue({
            sets: [
                {source: "owner/repo", id: "fr-a1", title: "French A1"},
            ],
        });
        getLessonMock.mockResolvedValue({title: "Greetings & Intro"});
        render(
            <MemoryRouter>
                <PausedLessonsCard userId="user-1" />
            </MemoryRouter>,
        );
        const title = await screen.findByTestId(
            "paused-lesson-title-01-greetings.json",
        );
        expect(title).toHaveTextContent("French A1");
        expect(title).toHaveTextContent("Greetings & Intro");
    });

    it("never leaks a raw UUID for an imported-chat analysis part", async () => {
        const uuid = "b8ff9ed4-e201-42aa-8f96-83424332c3a4";
        const file = `analysis-${uuid}-part-3.json`;
        const row = {
            ..._progress(file),
            source: "user-generated",
            set_id: `analysis-${uuid}`,
        };
        listMock.mockResolvedValue([row]);
        // Uncached set + uncached lesson — the opaque-id guard must engage.
        listSetsMock.mockResolvedValue({sets: []});
        getLessonMock.mockResolvedValue(null);
        render(
            <MemoryRouter>
                <PausedLessonsCard userId="user-1" />
            </MemoryRouter>,
        );
        const title = await screen.findByTestId(
            `paused-lesson-title-${file}`,
        );
        // No raw hash leaks through.
        expect(title.textContent).not.toMatch(/b8ff9ed4/);
        // Readable fallbacks, with the part number preserved.
        expect(title).toHaveTextContent("Imported analysis");
        expect(title).toHaveTextContent("Part 3");
    });
});
