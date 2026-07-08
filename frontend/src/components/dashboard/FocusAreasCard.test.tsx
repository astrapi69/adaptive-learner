/**
 * Tests for the FocusAreasCard Dashboard widget
 * (Phase 53F / v1.36.0 / F-114).
 *
 * Pins:
 * - empty errors → returns null (no card rendered)
 * - non-empty active errors → card renders with focus items + CTA
 * - mastered-only errors → returns null
 * - CTA href links to the first focus element's set_id
 * - failure-tolerant: thrown error from storage hides the widget
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const listMock = vi.fn();
const listSetsMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            list: listMock,
            recordBulk: vi.fn(),
            reviewQueue: vi.fn(),
        },
        contentLoader: {listSets: listSetsMock},
    }),
}));

import FocusAreasCard from "./FocusAreasCard";
import type {ElementError} from "../../storage/types";

const NOW = "2026-05-28T12:00:00Z";

function makeError(overrides: Partial<ElementError> = {}): ElementError {
    return {
        id: overrides.id ?? "err-1",
        user_id: "user-1",
        set_id: overrides.set_id ?? "language-fr-a1",
        lesson_id: overrides.lesson_id ?? "01.json",
        exercise_id: overrides.exercise_id ?? "ex-1",
        element_key: overrides.element_key ?? "merci",
        element_type: overrides.element_type ?? "vocabulary",
        user_answer: overrides.user_answer ?? "mercy",
        correct_answer: overrides.correct_answer ?? "merci",
        error_count: overrides.error_count ?? 1,
        correct_streak: overrides.correct_streak ?? 0,
        last_error_at: overrides.last_error_at ?? NOW,
        last_attempt_at: overrides.last_attempt_at ?? NOW,
        mastered: overrides.mastered ?? false,
        mastered_at: overrides.mastered_at ?? null,
        created_at: NOW,
        updated_at: NOW,
    };
}

function renderCard(userId: string) {
    return render(
        <MemoryRouter>
            <FocusAreasCard userId={userId} />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    listMock.mockReset();
    // Default: the sets behind the test errors are loadable, so the #1445
    // availability filter is a no-op unless a test removes them.
    listSetsMock.mockReset().mockResolvedValue({
        sets: [
            {source: "astrapi69/adaptive-learner-content", id: "language-fr-a1"},
            {source: "astrapi69/adaptive-learner-content", id: "language-es-a1"},
        ],
    });
});

describe("FocusAreasCard", () => {
    it("renders nothing when no userId", () => {
        renderCard("");
        expect(screen.queryByTestId("focus-areas-card")).toBeNull();
        expect(screen.queryByTestId("focus-areas-card-loading")).toBeNull();
    });

    it("returns null when the user has no active errors", async () => {
        listMock.mockResolvedValue([]);
        renderCard("user-1");
        await waitFor(() => {
            expect(
                screen.queryByTestId("focus-areas-card-loading"),
            ).toBeNull();
        });
        expect(screen.queryByTestId("focus-areas-card")).toBeNull();
    });

    it("returns null when all errors are mastered (no active focus)", async () => {
        listMock.mockResolvedValue([
            makeError({element_key: "bonjour", mastered: true, error_count: 5}),
        ]);
        renderCard("user-1");
        await waitFor(() => {
            expect(
                screen.queryByTestId("focus-areas-card-loading"),
            ).toBeNull();
        });
        expect(screen.queryByTestId("focus-areas-card")).toBeNull();
    });

    it("renders the card with focus items when active errors exist", async () => {
        listMock.mockResolvedValue([
            makeError({
                element_key: "merci",
                error_count: 3,
                correct_streak: 1,
            }),
        ]);
        renderCard("user-1");
        const card = await screen.findByTestId("focus-areas-card");
        expect(card).toBeVisible();
        expect(
            screen.getByTestId("focus-area-item-merci"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("focus-areas-cta")).toHaveAttribute(
            "href",
            "/adaptive-lesson/language-fr-a1",
        );
    });

    it("renders tag chips when at least one heuristic matches", async () => {
        listMock.mockResolvedValue([
            makeError({
                element_key: "le",
                user_answer: "la",
                correct_answer: "le",
                error_count: 4,
            }),
        ]);
        renderCard("user-1");
        const tags = await screen.findByTestId("focus-areas-tags");
        expect(tags.textContent).toMatch(/Article gender/i);
    });

    it("hides the widget when storage throws", async () => {
        listMock.mockRejectedValue(new Error("boom"));
        renderCard("user-1");
        await waitFor(() => {
            expect(
                screen.queryByTestId("focus-areas-card-loading"),
            ).toBeNull();
        });
        expect(screen.queryByTestId("focus-areas-card")).toBeNull();
    });

    it("links CTA to the first focus element's set_id", async () => {
        listMock.mockResolvedValue([
            makeError({
                element_key: "k1",
                set_id: "language-es-a1",
                error_count: 5,
            }),
            makeError({
                element_key: "k2",
                set_id: "language-fr-a1",
                error_count: 1,
            }),
        ]);
        renderCard("user-1");
        const cta = await screen.findByTestId("focus-areas-cta");
        expect(cta).toHaveAttribute(
            "href",
            "/adaptive-lesson/language-es-a1",
        );
    });

    it("ignores errors whose set is no longer loadable (#1445)", async () => {
        listMock.mockResolvedValue([
            makeError({element_key: "gone", set_id: "orphan-set", error_count: 9}),
            makeError({element_key: "keep", set_id: "language-fr-a1", error_count: 2}),
        ]);
        // Only language-fr-a1 remains loadable; orphan-set's repo was removed.
        listSetsMock.mockResolvedValue({
            sets: [
                {
                    source: "astrapi69/adaptive-learner-content",
                    id: "language-fr-a1",
                },
            ],
        });
        renderCard("user-1");
        const cta = await screen.findByTestId("focus-areas-cta");
        // The high-error orphaned set is ignored; the CTA targets the loadable
        // set instead of leading into a removed repo.
        expect(cta).toHaveAttribute("href", "/adaptive-lesson/language-fr-a1");
    });
});
