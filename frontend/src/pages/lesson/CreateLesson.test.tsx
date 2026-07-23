/**
 * Tests for the Lesson Creator wizard — Step 1 / metadata
 * (Phase 65A / EXP-021).
 *
 * Pins: renders step 1, required-title validation, same-language
 * validation, advance to step 2, and the cancel/discard flow.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
    ...(await orig<typeof import("react-router-dom")>()),
    useNavigate: () => navigateMock,
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
const downloadLessonJsonMock = vi.fn();
vi.mock("../../lib/content/lesson/lesson-export", () => ({
    downloadLessonJson: (...a: unknown[]) => downloadLessonJsonMock(...a),
}));

import CreateLesson from "./CreateLesson";
import {PAGE_CONTAINER_CLASSES} from "../../shared/layout/PageContainer";
import {buildLessonFromDraft} from "../../lib/content/lesson/draft-to-lesson";
import {generateExercises} from "../../lib/exercises";
import type {LessonMeta} from "../../lib/content/lesson/lesson-draft";

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/create-lesson"]}>
            <CreateLesson />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    navigateMock.mockReset();
    localStorage.clear();
});

describe("CreateLesson — metadata step", () => {
    it("renders step 1 with the step indicator", () => {
        renderPage();
        expect(screen.getByTestId("create-lesson-page")).toBeInTheDocument();
        expect(screen.getByTestId("create-lesson-step-1")).toBeInTheDocument();
        expect(
            screen.getByTestId("create-lesson-step-indicator").textContent,
        ).toContain("1");
    });

    it("blocks Next when the title is empty", () => {
        renderPage();
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("create-lesson-title-error"),
        ).toBeInTheDocument();
        // Still on step 1.
        expect(screen.getByTestId("create-lesson-step-1")).toBeInTheDocument();
        expect(
            screen.queryByTestId("create-lesson-step-2"),
        ).not.toBeInTheDocument();
    });

    it("advances even when source and target language match (#1715, knowledge domains)", async () => {
        const user = userEvent.setup();
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "KI für Einsteiger"},
        });
        // Force target == source by picking the same language in both
        // shadcn/Radix Selects — a legitimate knowledge-domain pair
        // (e.g. the ki-einsteiger set: de -> de).
        await user.click(screen.getByTestId("create-lesson-source-lang"));
        await user.click(await screen.findByRole("option", {name: "English"}));
        await user.click(screen.getByTestId("create-lesson-target-lang"));
        await user.click(await screen.findByRole("option", {name: "English"}));
        // A same-language pair is no longer a blocking error.
        expect(
            screen.queryByTestId("create-lesson-same-language-error"),
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(screen.getByTestId("create-lesson-step-2")).toBeInTheDocument();
    });

    it("advances to step 2 when metadata is valid", () => {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "My French Basics"},
        });
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(screen.getByTestId("create-lesson-step-2")).toBeInTheDocument();
        expect(screen.getByTestId("create-lesson-back")).toBeInTheDocument();
    });

    it("cancels straight to /content when nothing is entered", () => {
        renderPage();
        fireEvent.click(screen.getByTestId("create-lesson-cancel"));
        expect(navigateMock).toHaveBeenCalledWith("/content?tab=my");
        expect(
            screen.queryByTestId("create-lesson-cancel-confirm"),
        ).not.toBeInTheDocument();
    });

    it("confirms before discarding a dirty lesson", () => {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "Work in progress"},
        });
        fireEvent.click(screen.getByTestId("create-lesson-cancel"));
        // Confirm dialog, not an immediate navigation.
        expect(
            screen.getByTestId("create-lesson-cancel-confirm"),
        ).toBeInTheDocument();
        expect(navigateMock).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId("create-lesson-cancel-discard"));
        expect(navigateMock).toHaveBeenCalledWith("/content?tab=my");
    });
});

describe("CreateLesson — card step gate + draft", () => {
    function toStep2() {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "My French Basics"},
        });
        fireEvent.click(screen.getByTestId("create-lesson-next"));
    }

    function addCard(front: string, back: string) {
        fireEvent.change(screen.getByTestId("card-front-input"), {
            target: {value: front},
        });
        fireEvent.change(screen.getByTestId("card-back-input"), {
            target: {value: back},
        });
        fireEvent.click(screen.getByTestId("card-add-button"));
    }

    it("pre-fills cards from a template", () => {
        renderPage();
        fireEvent.click(screen.getByTestId("template-vocabulary"));
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "Vocab lesson"},
        });
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(screen.getByTestId("card-count").textContent).toContain("10");
    });

    it("marks the clicked template card as selected (#1756)", () => {
        renderPage();
        // Before any click no card is pressed.
        expect(
            screen.getByTestId("template-vocabulary").getAttribute("aria-pressed"),
        ).toBe("false");
        fireEvent.click(screen.getByTestId("template-vocabulary"));
        expect(
            screen.getByTestId("template-vocabulary").getAttribute("aria-pressed"),
        ).toBe("true");
        // Only ONE card carries the selected state.
        expect(
            screen.getByTestId("template-grammar").getAttribute("aria-pressed"),
        ).toBe("false");
        // Picking another template moves the selection.
        fireEvent.click(screen.getByTestId("template-grammar"));
        expect(
            screen.getByTestId("template-grammar").getAttribute("aria-pressed"),
        ).toBe("true");
        expect(
            screen.getByTestId("template-vocabulary").getAttribute("aria-pressed"),
        ).toBe("false");
    });

    it("blocks step 3 until at least 4 cards exist", () => {
        toStep2();
        expect(screen.getByTestId("create-lesson-step-2")).toBeInTheDocument();
        // 0 cards → Next blocked.
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("create-lesson-card-error"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("create-lesson-step-2")).toBeInTheDocument();
        // Add 4 cards → Next advances to step 3.
        addCard("Bonjour", "Hallo");
        addCard("Merci", "Danke");
        addCard("Oui", "Ja");
        addCard("Non", "Nein");
        expect(screen.getByTestId("card-count").textContent).toContain("4");
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(screen.getByTestId("create-lesson-step-3")).toBeInTheDocument();
    });

    it("generates exercises and gates step 4 on a minimum of 5", () => {
        toStep2();
        addCard("Bonjour", "Hallo");
        addCard("Merci", "Danke");
        addCard("Oui", "Ja");
        addCard("Non", "Nein");
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → step 3
        expect(screen.getByTestId("create-lesson-step-3")).toBeInTheDocument();
        // No exercises yet → Next blocked.
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("create-lesson-exercise-error"),
        ).toBeInTheDocument();
        // Auto-generate, then advance to step 4.
        fireEvent.click(screen.getByTestId("exercise-generate"));
        expect(
            Number(screen.getByTestId("exercise-list-count").textContent?.match(/\d+/)?.[0]),
        ).toBeGreaterThanOrEqual(5);
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(screen.getByTestId("create-lesson-step-4")).toBeInTheDocument();
    });

    it("saves the lesson locally and shows the next-step panel", async () => {
        saveUserSetMock.mockClear();
        toStep2();
        addCard("Bonjour", "Hallo");
        addCard("Merci", "Danke");
        addCard("Oui", "Ja");
        addCard("Non", "Nein");
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → step 3
        fireEvent.click(screen.getByTestId("exercise-generate"));
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → step 4
        expect(screen.getByTestId("create-lesson-step-4")).toBeInTheDocument();
        const saveBtn = screen.getByTestId("create-lesson-save-local");
        expect(saveBtn).not.toBeDisabled();
        fireEvent.click(saveBtn);
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-saved"),
            ).toBeInTheDocument(),
        );
        expect(saveUserSetMock).toHaveBeenCalled();
        expect(screen.getByTestId("create-lesson-play")).toBeInTheDocument();
    });

    it("exports the saved lesson as a file (#1672)", async () => {
        downloadLessonJsonMock.mockClear();
        toStep2();
        addCard("Bonjour", "Hallo");
        addCard("Merci", "Danke");
        addCard("Oui", "Ja");
        addCard("Non", "Nein");
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → step 3
        fireEvent.click(screen.getByTestId("exercise-generate"));
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → step 4
        fireEvent.click(screen.getByTestId("create-lesson-save-local"));
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-saved"),
            ).toBeInTheDocument(),
        );
        fireEvent.click(screen.getByTestId("create-lesson-save-file"));
        expect(downloadLessonJsonMock).toHaveBeenCalledTimes(1);
        const lessonArg = downloadLessonJsonMock.mock.calls[0][0] as {
            id: string;
            steps: unknown[];
        };
        expect(lessonArg.id).toBeTruthy();
        expect(lessonArg.steps.length).toBeGreaterThan(0);
    });

    it("offers to restore a saved draft and continues it", () => {
        localStorage.setItem(
            "adaptive-learner.lesson-draft",
            JSON.stringify({
                schema: 1,
                step: 1,
                meta: {
                    title: "Saved draft lesson",
                    titleNative: "",
                    sourceLanguage: "de",
                    targetLanguage: "fr",
                    level: "A1",
                    description: "",
                    author: "",
                },
                cards: [],
                updatedAt: "2026-06-01T00:00:00Z",
            }),
        );
        renderPage();
        expect(
            screen.getByTestId("create-lesson-draft-prompt"),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("create-lesson-draft-continue"));
        expect(
            (screen.getByTestId("create-lesson-title") as HTMLInputElement)
                .value,
        ).toBe("Saved draft lesson");
    });

    it("a resumed draft with an equal language pair can still advance", () => {
        // P0 regression: a stale draft whose sourceLanguage ===
        // targetLanguage left Step 1 unadvanceable — the same-language
        // guard never cleared, so "Next" silently did nothing even with
        // every field filled. The loader now repairs the pair so the
        // resumed draft advances normally.
        localStorage.setItem(
            "adaptive-learner.lesson-draft",
            JSON.stringify({
                schema: 1,
                step: 1,
                meta: {
                    title: "Stuck draft",
                    titleNative: "",
                    sourceLanguage: "de",
                    targetLanguage: "de", // EQUAL — the stuck state
                    level: "A1",
                    description: "",
                    author: "",
                },
                cards: [],
                updatedAt: "2026-06-01T00:00:00Z",
            }),
        );
        renderPage();
        fireEvent.click(screen.getByTestId("create-lesson-draft-continue"));
        // The repaired pair is no longer equal: Weiter advances to
        // step 2 with no same-language error (instead of silently
        // failing on an equal source/target pair).
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(screen.getByTestId("create-lesson-step-2")).toBeInTheDocument();
        expect(
            screen.queryByTestId("create-lesson-same-language-error"),
        ).not.toBeInTheDocument();
    });
});

describe("CreateLesson — same-language is allowed (#1715, knowledge domains)", () => {
    async function pickBoth(langName: string) {
        const user = userEvent.setup();
        await user.click(screen.getByTestId("create-lesson-target-lang"));
        await user.click(await screen.findByRole("option", {name: langName}));
        await user.click(screen.getByTestId("create-lesson-source-lang"));
        await user.click(await screen.findByRole("option", {name: langName}));
    }

    it("shows a non-blocking same-language hint (not an error) when they match", async () => {
        renderPage();
        // No hint on the fresh, differing default pair.
        expect(
            screen.queryByTestId("create-lesson-same-language-hint"),
        ).not.toBeInTheDocument();
        await pickBoth("English");
        // A neutral, live hint — NOT a blocking error alert.
        const hint = screen.getByTestId("create-lesson-same-language-hint");
        expect(hint).toBeInTheDocument();
        expect(hint).not.toHaveAttribute("role", "alert");
        expect(
            screen.queryByTestId("create-lesson-same-language-error"),
        ).not.toBeInTheDocument();
    });

    it("does NOT mark the language selects as aria-invalid when they match", async () => {
        renderPage();
        await pickBoth("English");
        expect(
            screen.getByTestId("create-lesson-target-lang"),
        ).not.toHaveAttribute("aria-invalid", "true");
        expect(
            screen.getByTestId("create-lesson-source-lang"),
        ).not.toHaveAttribute("aria-invalid", "true");
    });

    it("hides the hint once the languages differ again", async () => {
        const user = userEvent.setup();
        renderPage();
        await pickBoth("English");
        expect(
            screen.getByTestId("create-lesson-same-language-hint"),
        ).toBeInTheDocument();
        await user.click(screen.getByTestId("create-lesson-target-lang"));
        await user.click(await screen.findByRole("option", {name: "French"}));
        expect(
            screen.queryByTestId("create-lesson-same-language-hint"),
        ).not.toBeInTheDocument();
    });

    it("runs a full same-language wizard end to end and saves", async () => {
        saveUserSetMock.mockClear();
        const user = userEvent.setup();
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "KI für Einsteiger"},
        });
        await user.click(screen.getByTestId("create-lesson-target-lang"));
        await user.click(await screen.findByRole("option", {name: "German"}));
        await user.click(screen.getByTestId("create-lesson-source-lang"));
        await user.click(await screen.findByRole("option", {name: "German"}));
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → step 2
        expect(screen.getByTestId("create-lesson-step-2")).toBeInTheDocument();
        const addCard = (front: string, back: string) => {
            fireEvent.change(screen.getByTestId("card-front-input"), {
                target: {value: front},
            });
            fireEvent.change(screen.getByTestId("card-back-input"), {
                target: {value: back},
            });
            fireEvent.click(screen.getByTestId("card-add-button"));
        };
        addCard("Was ist ein Modell?", "Eine Funktion");
        addCard("Was ist ein Token?", "Eine Texteinheit");
        addCard("Was ist Training?", "Parameteranpassung");
        addCard("Was ist Inferenz?", "Die Vorhersagephase");
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → step 3
        fireEvent.click(screen.getByTestId("exercise-generate"));
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → step 4
        expect(screen.getByTestId("create-lesson-step-4")).toBeInTheDocument();
        // The same-language pair does NOT block Save.
        const saveBtn = screen.getByTestId("create-lesson-save-local");
        expect(saveBtn).not.toBeDisabled();
        fireEvent.click(saveBtn);
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-saved"),
            ).toBeInTheDocument(),
        );
        expect(saveUserSetMock).toHaveBeenCalled();
        const savedInput = saveUserSetMock.mock.calls[0][0] as unknown as {
            source_language: string;
            target_language: string;
        };
        expect(savedInput.source_language).toBe("de");
        expect(savedInput.target_language).toBe("de");
    });
});

describe("CreateLesson — template cards layout (#1715)", () => {
    it("renders template cards as a spaced grid with separated title + desc", () => {
        renderPage();
        const grid = screen.getByTestId("create-lesson-templates").querySelector(
            "[data-testid='template-vocabulary']",
        )?.parentElement;
        expect(grid?.className).toContain("grid");
        expect(grid?.className).toMatch(/gap-/);
        const card = screen.getByTestId("template-vocabulary");
        // Real card chrome: border + padding.
        expect(card.className).toContain("border");
        expect(card.className).toMatch(/\bp-/);
    });
});

// #1740 — editing an existing own lesson through the pre-filled wizard.
describe("CreateLesson — edit mode (#1740)", () => {
    const EDIT_META: LessonMeta = {
        title: "Colours A1",
        titleNative: "Farben A1",
        sourceLanguage: "de",
        targetLanguage: "fr",
        level: "A2",
        description: "The original topic.",
        author: "Aster",
        domain: "language",
    };

    function fixtureLesson() {
        const cards = ["rouge", "bleu", "vert", "jaune", "noir"].map((w, i) => ({
            id: `c${i}`,
            front: w,
            back: `farbe-${i}`,
            notes: "",
            image: "",
        }));
        const exercises = generateExercises(
            cards.map((c) => ({id: c.id, front: c.front, back: c.back})),
            {count: 10, types: ["matching", "free_text"], direction: "auto"},
        );
        return buildLessonFromDraft({meta: EDIT_META, cards, exercises});
    }

    function renderEdit(setId = "created-colours-a1") {
        return render(
            <MemoryRouter
                initialEntries={[`/create-lesson/edit/user-generated/${setId}`]}
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
        saveUserSetMock.mockClear();
        const lesson = fixtureLesson();
        listLessonsMock.mockResolvedValue({
            set_id: "created-colours-a1",
            source: "user-generated",
            version: "1.0.0",
            lessons: [`${lesson.id}.json`],
        });
        getLessonMock.mockResolvedValue(lesson);
        listSetsMock.mockResolvedValue({
            sets: [
                {
                    source: "user-generated",
                    id: "created-colours-a1",
                    level: "A2",
                    title_native: "Farben A1",
                    domain: "imported",
                },
            ],
        });
    });

    it("opens pre-filled with the existing lesson's metadata", async () => {
        renderEdit();
        // Edit heading, not "Create a lesson".
        expect(
            screen.getByText("Edit lesson"),
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(
                (screen.getByTestId("create-lesson-title") as HTMLInputElement)
                    .value,
            ).toBe("Colours A1"),
        );
    });

    async function toReview() {
        renderEdit();
        await waitFor(() =>
            expect(
                (screen.getByTestId("create-lesson-title") as HTMLInputElement)
                    .value,
            ).toBe("Colours A1"),
        );
        // Cards + exercises are already pre-filled, so Next advances
        // through the gates straight to review.
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → 2
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → 3
        fireEvent.click(screen.getByTestId("create-lesson-next")); // → 4
        expect(screen.getByTestId("create-lesson-step-4")).toBeInTheDocument();
    }

    it("save overwrites the same set id (not a title-derived new id)", async () => {
        await toReview();
        // A rename must NOT change the overwrite target.
        fireEvent.click(screen.getByTestId("create-lesson-save-local"));
        await waitFor(() => expect(saveUserSetMock).toHaveBeenCalled());
        const input = saveUserSetMock.mock.calls[0][0] as unknown as {
            set_id: string;
            origin: string;
            lessons: {id: string}[];
        };
        expect(input.set_id).toBe("created-colours-a1");
        expect(input.origin).toBe("imported");
        // Same lesson filename id → progress keyed on it survives.
        expect(input.lessons[0].id).toBe(fixtureLesson().id);
    });

    it("offers Save-as-copy (not Save-and-share) in edit mode", async () => {
        await toReview();
        expect(
            screen.getByTestId("create-lesson-save-copy"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("create-lesson-save-share"),
        ).not.toBeInTheDocument();
    });

    it("Save-as-copy persists under a fresh, non-colliding set id", async () => {
        await toReview();
        fireEvent.click(screen.getByTestId("create-lesson-save-copy"));
        await waitFor(() => expect(saveUserSetMock).toHaveBeenCalled());
        const input = saveUserSetMock.mock.calls[0][0] as unknown as {
            set_id: string;
            title: string;
        };
        expect(input.set_id).not.toBe("created-colours-a1");
        expect(input.title).toContain("(copy)");
    });

    it("surfaces an error when the lesson can't be loaded", async () => {
        listLessonsMock.mockResolvedValue({
            set_id: "x",
            source: "user-generated",
            version: null,
            lessons: [],
        });
        renderEdit();
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-edit-error"),
            ).toBeInTheDocument(),
        );
    });
});

// #1852 — the extension-authoring wizard branch (editors 1+2). A full
// author-a-categorization-and-save round-trip proving the saved set carries
// requires_extensions (the load-guard contract for ext lessons).
describe("CreateLesson — extension wizard (#1852)", () => {
    beforeEach(() => {
        saveUserSetMock.mockClear();
    });

    it("authors a categorization exercise and saves a set with requires_extensions", async () => {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "Dog Signals"},
        });
        // Enter the extension path from the step-1 template card.
        fireEvent.click(screen.getByTestId("template-extensions"));
        expect(
            screen.getByTestId("create-lesson-extension-step"),
        ).toBeInTheDocument();

        // Add a categorization exercise; it auto-opens in the inline editor.
        fireEvent.click(screen.getByTestId("extension-add"));
        fireEvent.click(screen.getByTestId("extension-add-type-categorization"));
        const editor = screen.getByTestId(/^exercise-ext-editor-/);
        const id = editor
            .getAttribute("data-testid")!
            .replace("exercise-ext-editor-", "");

        fireEvent.change(screen.getByTestId(`exercise-ext-prompt-${id}`), {
            target: {value: "Sort each signal"},
        });
        // Name both buckets and give each one item (add-only StringListEditor).
        fireEvent.change(screen.getByTestId(`exercise-ext-cat-name-${id}-0`), {
            target: {value: "Sight"},
        });
        fireEvent.change(screen.getByTestId(`exercise-ext-cat-name-${id}-1`), {
            target: {value: "Sound"},
        });
        fireEvent.change(
            screen.getByTestId(`exercise-ext-cat-items-${id}-0-input`),
            {target: {value: "flat hand"}},
        );
        fireEvent.click(screen.getByTestId(`exercise-ext-cat-items-${id}-0-add`));
        fireEvent.change(
            screen.getByTestId(`exercise-ext-cat-items-${id}-1-input`),
            {target: {value: "Sit"}},
        );
        fireEvent.click(screen.getByTestId(`exercise-ext-cat-items-${id}-1-add`));

        // Save the exercise — the row collapses to its preview.
        fireEvent.click(screen.getByTestId(`exercise-ext-save-${id}`));

        // Advance to review and save locally.
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("create-lesson-extension-review"),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("create-lesson-save-local"));

        await waitFor(() => expect(saveUserSetMock).toHaveBeenCalledOnce());
        const input = saveUserSetMock.mock.calls[0][0] as unknown as {
            lessons: {requires_extensions?: string[]}[];
        };
        expect(input.lessons[0].requires_extensions).toContain(
            "ext:al-categorization@1",
        );
    });
});

describe("shared page container (#1384)", () => {
    it("renders inside the shared PageContainer, with no deviating wrapper", () => {
        renderPage();
        const main = screen.getByTestId("create-lesson-page");
        expect(main.tagName).toBe("MAIN");
        expect(main.getAttribute("data-slot")).toBe("page-container");
        // page + create-lesson-page were BOTH undefined CSS classes, so the
        // wizard silently ran full-width (#1384).
        expect(main.className).toBe(PAGE_CONTAINER_CLASSES);
    });
});
