/**
 * Integration test for the opportunistic legacy-prompt migration (#1860)
 * wired into the #1740 edit-load path.
 *
 * Uses a German ``useI18n`` mock so ``localizedExercisePrompts`` resolves to
 * German — the migration is a no-op under the English fallback the other
 * CreateLesson tests run with. The pure rule is pinned in
 * ``legacy-prompt-migration.test.ts``; this covers the wiring: migrate on
 * load, show the notice, and — crucially — do NOT persist without a save.
 */

import "@testing-library/jest-dom/vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
    ...(await orig<typeof import("react-router-dom")>()),
    useNavigate: () => navigateMock,
}));

// Resolve `t` against the REAL bundled de catalog so `localizedExercisePrompts`
// returns the actual German instructions (and validates the #1860 keys).
const deCatalog = JSON.parse(
    readFileSync(join(__dirname, "../../data/i18n/de.json"), "utf-8"),
) as Record<string, unknown>;

function tDe(key: string, fallback?: string): string {
    let cursor: unknown = deCatalog;
    for (const part of key.split(".")) {
        if (
            cursor &&
            typeof cursor === "object" &&
            part in (cursor as Record<string, unknown>)
        ) {
            cursor = (cursor as Record<string, unknown>)[part];
        } else {
            return fallback ?? key;
        }
    }
    return typeof cursor === "string" ? cursor : (fallback ?? key);
}

vi.mock("../../hooks/ui/useI18n", async (orig) => ({
    ...(await orig<typeof import("../../hooks/ui/useI18n")>()),
    useI18n: () => ({t: tDe, lang: "de", setLang: () => {}}),
}));

const saveUserSetMock = vi.fn(async (input: {set_id: string; title: string}) => ({
    id: input.set_id,
    source: "user-generated",
    title: input.title,
}));
const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const listSetsMock = vi.fn();
vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            saveUserSet: saveUserSetMock,
            listLessons: listLessonsMock,
            getLesson: getLessonMock,
            listSets: listSetsMock,
        },
    }),
}));
vi.mock("../../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));
vi.mock("../../lib/content/lesson/lesson-export", () => ({
    downloadLessonJson: vi.fn(),
}));

import CreateLesson from "./CreateLesson";
import {buildLessonFromDraft} from "../../lib/content/lesson/draft-to-lesson";
import {
    DEFAULT_EXERCISE_PROMPTS,
    generateExercises,
} from "../../lib/exercises";
import type {LessonMeta} from "../../lib/content/lesson/lesson-draft";

const META: LessonMeta = {
    title: "Legacy Set",
    titleNative: "Legacy Set FR",
    sourceLanguage: "de",
    targetLanguage: "fr",
    level: "A1",
    description: "A legacy lesson.",
    author: "Aster",
    domain: "language",
};

/** A lesson whose matching exercise carries the exact old English default
 *  prompt (generateExercises defaults to DEFAULT_EXERCISE_PROMPTS). */
function legacyLesson() {
    const cards = ["un", "deux", "trois", "quatre", "cinq"].map((w, i) => ({
        id: `c${i}`,
        front: w,
        back: `wort-${i}`,
        notes: "",
        image: "",
    }));
    return buildLessonFromDraft({
        meta: META,
        cards,
        exercises: generateExercises(
            cards.map((c) => ({id: c.id, front: c.front, back: c.back})),
            {count: 10, types: ["matching", "free_text"], direction: "auto"},
        ),
    });
}

function renderEdit() {
    return render(
        <MemoryRouter
            initialEntries={["/create-lesson/edit/user-generated/created-legacy"]}
        >
            <Routes>
                <Route
                    path="/create-lesson/edit/:source/:setId"
                    element={<CreateLesson />}
                />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    navigateMock.mockReset();
    saveUserSetMock.mockClear();
    localStorage.clear();
    const lesson = legacyLesson();
    listLessonsMock.mockResolvedValue({
        set_id: "created-legacy",
        source: "user-generated",
        version: "1.0.0",
        lessons: [`${lesson.id}.json`],
    });
    getLessonMock.mockResolvedValue(lesson);
    listSetsMock.mockResolvedValue({
        sets: [
            {
                source: "user-generated",
                id: "created-legacy",
                level: "A1",
                title_native: "Legacy Set FR",
                domain: "imported",
            },
        ],
    });
});

describe("CreateLesson — legacy prompt migration on edit (#1860)", () => {
    it("migrates the exact English default and shows the notice", async () => {
        // Precondition: the fixture really carries the old default.
        expect(legacyLesson().steps.some((s) => s.exercise?.prompt ===
            DEFAULT_EXERCISE_PROMPTS.matching)).toBe(true);

        renderEdit();
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-prompts-migrated"),
            ).toBeInTheDocument(),
        );
    });

    it("persists the migrated German prompt only after an explicit save", async () => {
        renderEdit();
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-prompts-migrated"),
            ).toBeInTheDocument(),
        );
        // Cards + exercises are pre-filled, so Next walks straight to review.
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → 2
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → 3
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → 4
        fireEvent.click(screen.getByTestId("create-lesson-save-local"));

        await waitFor(() => expect(saveUserSetMock).toHaveBeenCalledOnce());
        const input = saveUserSetMock.mock.calls[0][0] as unknown as {
            lessons: {steps: {exercise?: {prompt?: string}}[]}[];
        };
        const prompts = input.lessons[0].steps
            .map((s) => s.exercise?.prompt)
            .filter(Boolean);
        expect(prompts).toContain("Ordne jedes Wort seiner Übersetzung zu.");
        expect(prompts).not.toContain(DEFAULT_EXERCISE_PROMPTS.matching);
    });

    it("does NOT persist the migration without an explicit save", async () => {
        renderEdit();
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-prompts-migrated"),
            ).toBeInTheDocument(),
        );
        // Migration lives in edit state only — no save was clicked.
        expect(saveUserSetMock).not.toHaveBeenCalled();
    });

    it("dismisses the notice without persisting", async () => {
        renderEdit();
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-prompts-migrated"),
            ).toBeInTheDocument(),
        );
        fireEvent.click(
            screen.getByTestId("create-lesson-prompts-migrated-dismiss"),
        );
        expect(
            screen.queryByTestId("create-lesson-prompts-migrated"),
        ).not.toBeInTheDocument();
        expect(saveUserSetMock).not.toHaveBeenCalled();
    });
});
