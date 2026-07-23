/**
 * #1946 — the book-text wizard path (knowledge-from-text, #1743) must
 * enforce the same title-required validation as the main wizard, so a
 * user can never reach the save step without a title and hit the raw
 * ajv schema error ("generated lesson invalid: /title must NOT have
 * fewer than 1 characters").
 *
 * Kept in its own file so the AI-generation seams can be module-mocked
 * without touching the main CreateLesson.test.tsx mock surface.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
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
vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            saveUserSet: saveUserSetMock,
            listLessons: vi.fn(),
            getLesson: vi.fn(),
            listSets: vi.fn(async () => ({sets: []})),
        },
    }),
}));

const notifyErrorMock = vi.fn();
const notifySuccessMock = vi.fn();
vi.mock("../../utils/notify", () => ({
    notify: {
        success: (...a: unknown[]) => notifySuccessMock(...a),
        error: (...a: unknown[]) => notifyErrorMock(...a),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

// AI-generation seams — the book path calls these on "Generate".
vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "u1"}),
}));
vi.mock("../../lib/ai/providers/resolve-provider", () => ({
    resolveActiveAiProvider: vi.fn(async () => ({
        provider: "anthropic",
        model: "claude",
        apiKey: "sk-test",
    })),
}));
vi.mock("../../lib/ai/generation/generate-theory-from-text", () => ({
    generateTheoryFromText: vi.fn(async () => ({
        steps: [
            {
                id: "theory-1",
                title: "Pawlow",
                body: "Ein neutraler Reiz wird durch Kopplung zum bedingten Reiz.",
            },
        ],
        errors: [],
    })),
}));
vi.mock("../../lib/ai/generation/generate-exercises", () => ({
    browserDirectProvider: vi.fn(() => ({})),
    generateExercises: vi.fn(async () => ({
        cards: [
            {
                type: "free_text",
                question: "Was wird aus einem neutralen Reiz?",
                accepts: ["ein bedingter Reiz"],
                distractors: [],
            },
        ],
        skipped: 0,
        errors: [],
        rejected: [],
        warnings: [],
    })),
}));
vi.mock("../../lib/ai/generation/cards-to-exercises", () => ({
    cardsToExercises: vi.fn(() => ({
        exercises: [
            {
                id: "ai-ex-1-free-text",
                type: "free_text",
                prompt: "Was wird aus einem neutralen Reiz?",
                card_ids: [],
                accept: ["ein bedingter Reiz"],
                distractors: [],
            },
        ],
    })),
}));

// #1927 — book file-upload parser seam. Both incoming reports drove the
// FILE UPLOAD path (book-upload-button → book-upload-apply), not the paste
// textarea; mock the parser so the upload → apply → generate → save flow
// runs without a real EPUB/TXT file. Spreads the real module so the limit
// constants BookFileUpload imports keep their genuine values.
vi.mock("../../lib/content/book-upload", async (orig) => ({
    ...(await orig<typeof import("../../lib/content/book-upload")>()),
    parseBookFile: vi.fn(async () => ({
        ok: true,
        book: {
            format: "text",
            sections: [
                {
                    id: "s1",
                    title: "Kapitel 1",
                    text: "Ein neutraler Reiz wird durch Kopplung zum bedingten Reiz.",
                    charCount: 57,
                },
            ],
        },
    })),
}));

import {parseBookFile} from "../../lib/content/book-upload";
import CreateLesson from "./CreateLesson";

/** The module-level mock forces a single section; batch tests override it
 *  per-run with a multi-section parse (#1949). */
const parseBookFileMock = vi.mocked(parseBookFile);

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/create-lesson"]}>
            <CreateLesson />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    navigateMock.mockReset();
    saveUserSetMock.mockClear();
    notifyErrorMock.mockClear();
    notifySuccessMock.mockClear();
    localStorage.clear();
});

describe("CreateLesson — book wizard title validation (#1946)", () => {
    it("blocks entering the book path without a title (shows the friendly error, not the book step)", () => {
        renderPage();
        // Enter the book path from the step-1 template card WITHOUT a title.
        fireEvent.click(screen.getByTestId("template-knowledge-from-text"));
        // Stays on step 1 with the user-friendly title error — the book
        // step must NOT open, so the raw ajv error is never reachable.
        expect(
            screen.getByTestId("create-lesson-title-error"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("create-lesson-step-1")).toBeInTheDocument();
        expect(
            screen.queryByTestId("create-lesson-book-step"),
        ).not.toBeInTheDocument();
    });

    it("enters the book path once a title is present", () => {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "Klassische Konditionierung"},
        });
        fireEvent.click(screen.getByTestId("template-knowledge-from-text"));
        expect(screen.getByTestId("create-lesson-book-step")).toBeInTheDocument();
        expect(
            screen.queryByTestId("create-lesson-title-error"),
        ).not.toBeInTheDocument();
    });

    it("runs the full book path with a title and saves successfully (regression)", async () => {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "Klassische Konditionierung"},
        });
        fireEvent.click(screen.getByTestId("template-knowledge-from-text"));
        fireEvent.change(screen.getByTestId("book-text-input"), {
            target: {value: "Ein neutraler Reiz wird zum bedingten Reiz."},
        });
        fireEvent.click(screen.getByTestId("book-generate"));
        // Generation is async; wait for the generated summary.
        await waitFor(() =>
            expect(
                screen.getByTestId("book-generated-summary"),
            ).toBeInTheDocument(),
        );
        // Advance to review and save locally.
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("create-lesson-book-review"),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("book-save-local"));
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-saved"),
            ).toBeInTheDocument(),
        );
        expect(saveUserSetMock).toHaveBeenCalledOnce();
        const input = saveUserSetMock.mock.calls[0][0] as {title: string};
        expect(input.title).toBe("Klassische Konditionierung");
        // No raw ajv schema error was ever surfaced.
        for (const call of notifyErrorMock.mock.calls) {
            expect(String(call[0])).not.toMatch(/must NOT have fewer/);
        }
    });

    it("batch-generates N lessons from selected sections and saves them into one set (#1949)", async () => {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "Psychologie Grundlagen"},
        });
        fireEvent.click(screen.getByTestId("template-knowledge-from-text"));
        // Parse into 3 sections, one of which is front matter (the real
        // heuristic — spread from the un-mocked module — deselects "Vorwort").
        parseBookFileMock.mockResolvedValueOnce({
            ok: true,
            book: {
                format: "text",
                sections: [
                    {id: "s1", title: "Vorwort", text: "Danke.", charCount: 6},
                    {id: "s2", title: "Kapitel 1", text: "Reize.", charCount: 6},
                    {id: "s3", title: "Kapitel 2", text: "Modelllernen.", charCount: 13},
                ],
            },
        });
        fireEvent.change(screen.getByTestId("book-upload-input"), {
            target: {files: [new File(["x"], "buch.md", {type: "text/markdown"})]},
        });
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeInTheDocument(),
        );
        // The heuristic deselected "Vorwort"; the two chapters stay checked.
        const button = screen.getByTestId("book-upload-apply");
        expect(button.textContent).toContain("Generate 2");
        fireEvent.click(button);
        await waitFor(() =>
            expect(
                screen.getByTestId("book-batch-summary"),
            ).toBeInTheDocument(),
        );
        // Advance to review — two lessons summarised.
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("book-review-lessons").textContent,
        ).toContain("2");
        fireEvent.click(screen.getByTestId("book-save-local"));
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-saved"),
            ).toBeInTheDocument(),
        );
        expect(saveUserSetMock).toHaveBeenCalledOnce();
        const input = saveUserSetMock.mock.calls[0][0] as unknown as {
            title: string;
            lessons: Array<{title: string}>;
        };
        // One set titled by the wizard metadata, two lessons titled by the
        // selected sections in document order.
        expect(input.title).toBe("Psychologie Grundlagen");
        expect(input.lessons).toHaveLength(2);
        expect(input.lessons.map((l) => l.title)).toEqual([
            "Kapitel 1",
            "Kapitel 2",
        ]);
    });

    it("shows a friendly message (never the raw ajv error) if a save is attempted without a title (defense-in-depth)", async () => {
        // Enter the book path with a title, generate, reach review, then
        // clear the title via a Back → step-1 edit before saving. The
        // save guard must surface the friendly title-required message,
        // not the raw ajv "/title must NOT have fewer than 1 characters".
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "Temp title"},
        });
        fireEvent.click(screen.getByTestId("template-knowledge-from-text"));
        fireEvent.change(screen.getByTestId("book-text-input"), {
            target: {value: "Ein neutraler Reiz wird zum bedingten Reiz."},
        });
        fireEvent.click(screen.getByTestId("book-generate"));
        await waitFor(() =>
            expect(
                screen.getByTestId("book-generated-summary"),
            ).toBeInTheDocument(),
        );
        // Back to step 1, blank the title.
        fireEvent.click(screen.getByTestId("create-lesson-back"));
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: ""},
        });
        // The step-1 Next guard blocks re-advancing without a title.
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("create-lesson-title-error"),
        ).toBeInTheDocument();
        // And the raw ajv error is never produced.
        for (const call of notifyErrorMock.mock.calls) {
            expect(String(call[0])).not.toMatch(/must NOT have fewer/);
        }
    });
});

describe("CreateLesson — book FILE-UPLOAD path (#1946 / #1927)", () => {
    // Both incoming #1946 reports drove the file-upload path
    // (book-upload-button → book-upload-apply), whereas the tests above
    // exercise the paste textarea. These pin the title guard AND a clean
    // save for the exact path that was reported twice, so the coverage is
    // visible rather than only implied by the shared upstream guard.

    /** Upload a (parser-mocked) file and apply its detected section into
     *  the book textarea. The textarea is empty on first apply, so no
     *  replace-confirm dialog appears. */
    async function uploadAndApplySection() {
        const file = new File(["chapter bytes"], "lehrbuch.txt", {
            type: "text/plain",
        });
        fireEvent.change(screen.getByTestId("book-upload-input"), {
            target: {files: [file]},
        });
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-apply")).toBeInTheDocument(),
        );
        fireEvent.click(screen.getByTestId("book-upload-apply"));
        await waitFor(() =>
            expect(
                (screen.getByTestId("book-text-input") as HTMLTextAreaElement)
                    .value,
            ).not.toBe(""),
        );
    }

    it("the file-upload UI is unreachable without a title (the guard is upstream of the upload button)", () => {
        renderPage();
        // No title → the knowledge-from-text template must stay on step 1,
        // so the book step that hosts the upload button never renders. This
        // is the preventive half that stops the reported upload → generate →
        // save-without-title path before it can even start.
        fireEvent.click(screen.getByTestId("template-knowledge-from-text"));
        expect(
            screen.getByTestId("create-lesson-title-error"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("book-upload-button"),
        ).not.toBeInTheDocument();
    });

    it("runs the full path via FILE UPLOAD (upload → apply → generate → save) with a title (regression)", async () => {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "Klassische Konditionierung"},
        });
        fireEvent.click(screen.getByTestId("template-knowledge-from-text"));
        await uploadAndApplySection();
        fireEvent.click(screen.getByTestId("book-generate"));
        await waitFor(() =>
            expect(
                screen.getByTestId("book-generated-summary"),
            ).toBeInTheDocument(),
        );
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("create-lesson-book-review"),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("book-save-local"));
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-saved"),
            ).toBeInTheDocument(),
        );
        expect(saveUserSetMock).toHaveBeenCalledOnce();
        const input = saveUserSetMock.mock.calls[0][0] as {title: string};
        expect(input.title).toBe("Klassische Konditionierung");
        // The raw ajv error is never surfaced on the upload path either.
        for (const call of notifyErrorMock.mock.calls) {
            expect(String(call[0])).not.toMatch(/must NOT have fewer/);
        }
    });

    it("after upload + generate, clearing the title blocks the save step (upload path never reaches an empty-title save)", async () => {
        renderPage();
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: "Temp title"},
        });
        fireEvent.click(screen.getByTestId("template-knowledge-from-text"));
        await uploadAndApplySection();
        fireEvent.click(screen.getByTestId("book-generate"));
        await waitFor(() =>
            expect(
                screen.getByTestId("book-generated-summary"),
            ).toBeInTheDocument(),
        );
        // Back to step 1, blank the title, try to re-advance — blocked.
        fireEvent.click(screen.getByTestId("create-lesson-back"));
        fireEvent.change(screen.getByTestId("create-lesson-title"), {
            target: {value: ""},
        });
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        expect(
            screen.getByTestId("create-lesson-title-error"),
        ).toBeInTheDocument();
        expect(saveUserSetMock).not.toHaveBeenCalled();
        for (const call of notifyErrorMock.mock.calls) {
            expect(String(call[0])).not.toMatch(/must NOT have fewer/);
        }
    });
});
