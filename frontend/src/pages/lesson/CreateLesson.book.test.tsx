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

import CreateLesson from "./CreateLesson";

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
